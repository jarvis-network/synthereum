// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.4;

import {ICreditLineStorage} from './interfaces/ICreditLineStorage.sol';
import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {IStandardERC20} from '../../../base/interfaces/IStandardERC20.sol';
import {
  BaseControlledMintableBurnableERC20
} from '../../../tokens/interfaces/BaseControlledMintableBurnableERC20.sol';
import {ISynthereumFinder} from '../../../core/interfaces/IFinder.sol';
import {ICreditLine} from './interfaces/ICreditLine.sol';
import {SynthereumInterfaces} from '../../../core/Constants.sol';
import {
  FixedPoint
} from '@uma/core/contracts/common/implementation/FixedPoint.sol';
import {SafeMath} from '@openzeppelin/contracts/utils/math/SafeMath.sol';
import {
  SafeERC20
} from '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import {SynthereumCreditLineLib} from './CreditLineLib.sol';
import {Lockable} from '@uma/core/contracts/common/implementation/Lockable.sol';

/**
 * @title Financial contract with priceless position management.
 * @notice Handles positions for multiple sponsors in an optimistic (i.e., priceless) way without relying
 * on a price feed. On construction, deploys a new ERC20, managed by this contract, that is the synthetic token.
 */
contract SynthereumCreditLine is ICreditLine, ICreditLineStorage, Lockable {
  using SafeMath for uint256;
  using FixedPoint for FixedPoint.Unsigned;
  using SafeERC20 for IERC20;
  using SafeERC20 for BaseControlledMintableBurnableERC20;
  using SynthereumCreditLineLib for PositionData;
  using SynthereumCreditLineLib for PositionManagerData;

  /**
   * @notice Construct the PerpetualPositionManager.
   * @dev Deployer of this contract should consider carefully which parties have ability to mint and burn
   * the synthetic tokens referenced by `_tokenAddress`. This contract's security assumes that no external accounts
   * can mint new tokens, which could be used to steal all of this contract's locked collateral.
   * We recommend to only use synthetic token contracts whose sole Owner role (the role capable of adding & removing roles)
   * is assigned to this contract, whose sole Minter role is assigned to this contract, and whose
   * total supply is 0 prior to construction of this contract.
   * @param collateralAddress ERC20 token used as collateral for all positions.
   * @param tokenAddress ERC20 token used as synthetic token.
   * @param priceFeedIdentifier registered in the ChainLink Oracle for the synthetic.
   * @param minSponsorTokens minimum amount of collateral that must exist at any time in a position.
   * @param timerAddress Contract that stores the current time in a testing environment. Set to 0x0 for production.
   * @param excessTokenBeneficiary Beneficiary to send all excess token balances that accrue in the contract.
   * @param version Version of the self-minting derivative
   * @param synthereumFinder The SynthereumFinder contract
   */
  struct PositionManagerParams {
    address collateralAddress;
    address tokenAddress;
    bytes32 priceFeedIdentifier;
    FixedPoint.Unsigned minSponsorTokens;
    FixedPoint.Unsigned overCollateralization;
    FixedPoint.Unsigned liquidatorRewardPct;
    address timerAddress;
    address excessTokenBeneficiary; // TODO
    uint8 version;
    Fee fees;
    ISynthereumFinder synthereumFinder;
  }

  //----------------------------------------
  // Storage
  //----------------------------------------

  // Maps sponsor addresses to their positions. Each sponsor can have only one position.
  mapping(address => PositionData) public positions;

  // Liquidations are unique by ID per sponsor
  mapping(address => LiquidationData[]) public liquidations;

  GlobalPositionData public globalPositionData;

  PositionManagerData public positionManagerData;

  FeeStatus private feeStatus;

  //----------------------------------------
  // Events
  //----------------------------------------

  event Deposit(address indexed sponsor, uint256 indexed collateralAmount);
  event Withdrawal(address indexed sponsor, uint256 indexed collateralAmount);
  event PositionCreated(
    address indexed sponsor,
    uint256 indexed collateralAmount,
    uint256 indexed tokenAmount,
    uint256 feeAmount
  );
  event NewSponsor(address indexed sponsor);
  event EndedSponsorPosition(address indexed sponsor);
  event Redeem(
    address indexed sponsor,
    uint256 indexed collateralAmount,
    uint256 indexed tokenAmount,
    uint256 feeAmount
  );
  event Repay(
    address indexed sponsor,
    uint256 indexed numTokensRepaid,
    uint256 indexed newTokenCount,
    uint256 feeAmount
  );
  event EmergencyShutdown(
    address indexed caller,
    uint256 settlementPrice,
    uint256 shutdowntimestamp
  );
  event SettleEmergencyShutdown(
    address indexed caller,
    uint256 indexed collateralReturned,
    uint256 indexed tokensBurned
  );
  event Liquidation(
    address indexed sponsor,
    address indexed liquidator,
    uint256 liquidatedTokens,
    uint256 liquidatedCollateral,
    uint256 collateralReward,
    uint256 liquidationTime
  );

  //----------------------------------------
  // Modifiers
  //----------------------------------------

  modifier notEmergencyShutdown() {
    require(
      positionManagerData.emergencyShutdownTimestamp == 0,
      'Contract emergency shutdown'
    );
    _;
  }

  modifier isEmergencyShutdown() {
    require(
      positionManagerData.emergencyShutdownTimestamp != 0,
      'Contract not emergency shutdown'
    );
    _;
  }

  //----------------------------------------
  // Constructor
  //----------------------------------------

  /**
   * @notice Construct the SelfMintingPerpetualPositionManagerMultiParty.
   * @param _positionManagerData Input parameters of PositionManager (see PositionManagerData struct)
   */
  constructor(PositionManagerParams memory _positionManagerData) nonReentrant {
    require(
      _positionManagerData.overCollateralization.isGreaterThan(1),
      'CR must be higher than 100%'
    );

    positionManagerData.synthereumFinder = _positionManagerData
      .synthereumFinder;
    positionManagerData.collateralToken = IStandardERC20(
      _positionManagerData.collateralAddress
    );
    positionManagerData.tokenCurrency = BaseControlledMintableBurnableERC20(
      _positionManagerData.tokenAddress
    );
    positionManagerData.overCollateralization = _positionManagerData
      .overCollateralization;
    positionManagerData.liquidatorRewardPct = _positionManagerData
      .liquidatorRewardPct;
    positionManagerData.minSponsorTokens = _positionManagerData
      .minSponsorTokens;
    positionManagerData.priceIdentifier = _positionManagerData
      .priceFeedIdentifier;
    positionManagerData.excessTokenBeneficiary = _positionManagerData
      .excessTokenBeneficiary;
    positionManagerData.version = _positionManagerData.version;
    positionManagerData.setFeePercentage(
      _positionManagerData.fees.feePercentage
    );
    positionManagerData.setFeeRecipients(
      _positionManagerData.fees.feeRecipients,
      _positionManagerData.fees.feeProportions
    );
  }

  //----------------------------------------
  // External functions
  //----------------------------------------

  /**
   * @notice Transfers `collateralAmount` into the caller's position.
   * @dev Increases the collateralization level of a position after creation. This contract must be approved to spend
   * at least `collateralAmount` of collateral token
   * @param collateralAmount total amount of collateral tokens to be sent to the sponsor's position.
   */
  function deposit(uint256 collateralAmount) external override {
    depositTo(msg.sender, collateralAmount);
  }

  /**
   * @notice Transfers `collateralAmount` from the sponsor's position to the sponsor.
   * @dev Reverts if the withdrawal puts this position's collateralization ratio below the collateral requirement
   * @param collateralAmount is the amount of collateral to withdraw.
   * @return amountWithdrawn The actual amount of collateral withdrawn.
   */
  function withdraw(uint256 collateralAmount)
    external
    override
    notEmergencyShutdown()
    nonReentrant
    returns (uint256 amountWithdrawn)
  {
    PositionData storage positionData = _getPositionData(msg.sender);

    amountWithdrawn = positionData
      .withdraw(
      globalPositionData,
      positionManagerData,
      FixedPoint.Unsigned(collateralAmount)
    )
      .rawValue;
  }

  /**
   * @notice Creates tokens by creating a new position or by augmenting an existing position. Pulls `collateralAmount
   * ` into the sponsor's position and mints `numTokens` of `tokenCurrency`.
   * @dev Can only be called by a token sponsor. Might not mint the full proportional amount of collateral
   * in order to account for precision loss. This contract must be approved to spend at least `collateralAmount` of
   * `collateralCurrency`.
   * @param collateralAmount is the number of collateral tokens to collateralize the position with
   * @param numTokens is the number of tokens to mint from the position.
   */
  function create(uint256 collateralAmount, uint256 numTokens)
    external
    override
    notEmergencyShutdown()
    nonReentrant
    returns (uint256 feeAmount)
  {
    PositionData storage positionData = positions[msg.sender];
    feeAmount = positionData
      .create(
      globalPositionData,
      positionManagerData,
      FixedPoint.Unsigned(collateralAmount),
      FixedPoint.Unsigned(numTokens),
      feeStatus
    )
      .rawValue;
  }

  /**
   * @notice Burns `numTokens` of `tokenCurrency` and sends back the proportional amount of collateral
   * @dev Can only be called by a token sponsor. Might not redeem the full proportional amount of collateral
   * in order to account for precision loss. This contract must be approved to spend at least `numTokens` of
   * `tokenCurrency`.
   * @param numTokens is the number of tokens to be burnt for a commensurate amount of collateral.
   * @return amountWithdrawn The actual amount of collateral withdrawn.
   * @return feeAmount incurred fees in collateral token
   */
  function redeem(uint256 numTokens)
    external
    override
    notEmergencyShutdown()
    nonReentrant
    returns (uint256 amountWithdrawn, uint256 feeAmount)
  {
    PositionData storage positionData = _getPositionData(msg.sender);

    (
      FixedPoint.Unsigned memory collateralAmount,
      FixedPoint.Unsigned memory uFeeAmount
    ) =
      positionData.redeeem(
        globalPositionData,
        positionManagerData,
        FixedPoint.Unsigned(numTokens),
        feeStatus,
        msg.sender
      );

    amountWithdrawn = collateralAmount.rawValue;
    feeAmount = uFeeAmount.rawValue;
  }

  /**
   * @notice Burns `numTokens` of `tokenCurrency` to decrease sponsors position size, without sending back collateral.
   * This is done by a sponsor to increase position CR.
   * @dev Can only be called by token sponsor. This contract must be approved to spend `numTokens` of `tokenCurrency`.
   * @param numTokens is the number of tokens to be burnt for a commensurate amount of collateral.
   */
  function repay(uint256 numTokens)
    external
    override
    notEmergencyShutdown()
    nonReentrant
    returns (uint256 daoFeeAmount)
  {
    PositionData storage positionData = _getPositionData(msg.sender);
    daoFeeAmount = (
      positionData.repay(
        globalPositionData,
        positionManagerData,
        FixedPoint.Unsigned(numTokens),
        feeStatus
      )
    )
      .rawValue;
  }

  /**
   * @notice If the contract is emergency shutdown then all token holders and sponsor can redeem their tokens or
   * remaining collateral for underlying at the prevailing price defined by the on-chain oracle
   * @dev This burns all tokens from the caller of `tokenCurrency` and sends back the resolved settlement value of
   * collateral. Might not redeem the full proportional amount of collateral in order to account for
   * precision loss. This contract must be approved to spend `tokenCurrency` at least up to the caller's full balance.
   * @dev This contract must have the Burner role for the `tokenCurrency`.
   * @return amountWithdrawn The actual amount of collateral withdrawn.
   */
  function settleEmergencyShutdown()
    external
    override
    isEmergencyShutdown()
    nonReentrant
    returns (uint256 amountWithdrawn)
  {
    PositionData storage positionData = positions[msg.sender];
    amountWithdrawn = positionData
      .settleEmergencyShutdown(globalPositionData, positionManagerData)
      .rawValue;
  }

  /**
   * @notice Premature contract settlement under emergency circumstances.
   * @dev Only the governor can call this function as they are permissioned within the `FinancialContractAdmin`.
   * Upon emergency shutdown, the contract settlement time is set to the shutdown time. This enables withdrawal
   * to occur via the `settleEmergencyShutdown` function.
   */
  function emergencyShutdown()
    external
    override
    notEmergencyShutdown()
    nonReentrant
  {
    require(
      msg.sender ==
        positionManagerData.synthereumFinder.getImplementationAddress(
          SynthereumInterfaces.Manager
        ),
      'Caller must be a Synthereum manager'
    );
    // store timestamp and last price
    positionManagerData.emergencyShutdownTimestamp = block.timestamp;

    uint8 tokenCurrencyDecimals =
      IStandardERC20(address(positionManagerData.tokenCurrency)).decimals();
    FixedPoint.Unsigned memory scaledPrice =
      positionManagerData._getOraclePrice().div(
        (10**(uint256(18)).sub(tokenCurrencyDecimals))
      );
    positionManagerData.emergencyShutdownPrice = scaledPrice;

    emit EmergencyShutdown(
      msg.sender,
      scaledPrice.rawValue,
      positionManagerData.emergencyShutdownTimestamp
    );
  }

  /**
   * @notice Withdraw fees gained by the sender
   * @return feeClaimed Amount of fee claimed
   */
  function claimFee()
    external
    override
    nonReentrant
    returns (uint256 feeClaimed)
  {
    feeClaimed = positionManagerData.claimFee(feeStatus);
  }

  function liquidate(
    address sponsor,
    FixedPoint.Unsigned calldata maxTokensToLiquidate
  )
    external
    override
    notEmergencyShutdown()
    nonReentrant
    returns (
      uint256 tokensLiquidated,
      uint256 collateralLiquidated,
      uint256 collateralReward
    )
  {
    // Retrieve Position data for sponsor
    PositionData storage positionToLiquidate = _getPositionData(sponsor);

    // try to liquidate it - reverts if is properly collateralised
    (
      collateralLiquidated,
      tokensLiquidated,
      collateralReward
    ) = positionToLiquidate.liquidate(
      positionManagerData,
      globalPositionData,
      maxTokensToLiquidate
    );

    // store new liquidation
    liquidations[sponsor].push(
      LiquidationData(
        sponsor,
        msg.sender,
        block.timestamp,
        tokensLiquidated,
        collateralLiquidated
      )
    );

    emit Liquidation(
      sponsor,
      msg.sender,
      collateralLiquidated,
      tokensLiquidated,
      collateralReward,
      block.timestamp
    );
  }

  /**
   * @notice Gets an array of liquidations performed on a token sponsor
   * @param sponsor address of the TokenSponsor.
   * @return liquidationData An array of data for all liquidations performed on a token sponsor
   */
  function getLiquidations(address sponsor)
    external
    view
    override
    nonReentrantView()
    returns (LiquidationData[] memory liquidationData)
  {
    return liquidations[sponsor];
  }

  /** @notice A helper function for getLiquidationData function
   */
  function getLiquidationData(address sponsor, uint256 liquidationId)
    external
    view
    nonReentrantView()
    returns (LiquidationData memory liquidation)
  {
    LiquidationData[] memory liquidationArray = liquidations[sponsor];
    // Revert if the caller is attempting to access an invalid liquidation
    // (one that has never been created or one has never been initialized).
    require(liquidationId < liquidationArray.length, 'Invalid liquidation ID');
    return liquidationArray[liquidationId];
  }

  // TODO
  /**
   * @notice Drains any excess balance of the provided ERC20 token to a pre-selected beneficiary.
   * @dev This will drain down to the amount of tracked collateral and drain the full balance of any other token.
   * @param token address of the ERC20 token whose excess balance should be drained.
   */
  // function trimExcess(IERC20 token)
  //   external
  //   nonReentrant
  //   returns (uint256 amount)
  // {
  //   FixedPoint.Unsigned memory pfcAmount = _pfc();
  //   amount = positionManagerData
  //     .trimExcess(token, pfcAmount, feePayerData)
  //     .rawValue;
  // }

  /**
   * @notice Delete a TokenSponsor position (This function can only be called by the contract itself)
   * @param sponsor address of the TokenSponsor.
   */
  function deleteSponsorPosition(address sponsor) external override {
    require(
      msg.sender == address(this),
      'Only the contract can invoke this function'
    );
    delete positions[sponsor];
  }

  /**
   * @notice Accessor method for a sponsor's collateral.
   * @dev This is necessary because the struct returned by the positions() method shows
   * rawCollateral, which isn't a user-readable value.
   * @param sponsor address whose collateral amount is retrieved.
   * @return collateralAmount amount of collateral within a sponsors position.
   */
  function getPositionCollateral(address sponsor)
    external
    view
    override
    nonReentrantView()
    returns (FixedPoint.Unsigned memory collateralAmount)
  {
    return positions[sponsor].rawCollateral;
  }

  /**
   * @notice Get SynthereumFinder contract address
   * @return finder SynthereumFinder contract
   */
  function synthereumFinder()
    external
    view
    override
    returns (ISynthereumFinder finder)
  {
    finder = positionManagerData.synthereumFinder;
  }

  /**
   * @notice Get synthetic token currency
   * @return synthToken Synthetic token
   */
  function tokenCurrency() external view override returns (IERC20 synthToken) {
    synthToken = positionManagerData.tokenCurrency;
  }

  /**
   * @notice Get synthetic token symbol
   * @return symbol Synthetic token symbol
   */
  function syntheticTokenSymbol()
    external
    view
    override
    returns (string memory symbol)
  {
    symbol = IStandardERC20(address(positionManagerData.tokenCurrency))
      .symbol();
  }

  /** @notice Get the version of a self minting derivative
   * @return contractVersion Contract version
   */
  function version() external view override returns (uint8 contractVersion) {
    contractVersion = positionManagerData.version;
  }

  /**
   * @notice Get synthetic token price identifier registered with UMA DVM
   * @return identifier Synthetic token price identifier
   */
  function priceIdentifier() external view returns (bytes32 identifier) {
    identifier = positionManagerData.priceIdentifier;
  }

  /**
   * @notice Get the currently minted synthetic tokens from all self-minting derivatives
   * @return totalTokens Total amount of synthetic tokens minted
   */
  function totalTokensOutstanding() external view returns (uint256) {
    return globalPositionData.totalTokensOutstanding.rawValue;
  }

  /**
   * @notice Get the price of synthetic token set by DVM after emergencyShutdown call
   * @return Price of synthetic token
   */
  function emergencyShutdownPrice()
    external
    view
    isEmergencyShutdown()
    returns (uint256)
  {
    return positionManagerData.emergencyShutdownPrice.rawValue;
  }

  /** @notice Check the current cap on self-minting synthetic tokens.
   * A cap mint amount is set in order to avoid depletion of liquidity pools,
   * by self-minting synthetic assets and redeeming collateral from the pools.
   * The cap mint amount is updateable and is based on a percentage of the currently
   * minted synthetic assets from the liquidity pools.
   * @return capMint The currently set cap amount for self-minting a synthetic token
   */
  function capMintAmount() external view returns (uint256 capMint) {
    capMint = positionManagerData.capMintAmount().rawValue;
  }

  /**
   * @notice Transfers `collateralAmount` of collateral into the specified sponsor's position.
   * @dev Increases the collateralization level of a position after creation. This contract must be approved to spend
   * at least `collateralAmount` of collateral token
   * @param sponsor the sponsor to credit the deposit to.
   * @param collateralAmount total amount of collateral tokens to be sent to the sponsor's position.
   */
  function depositTo(address sponsor, uint256 collateralAmount)
    public
    notEmergencyShutdown()
    nonReentrant
  {
    PositionData storage positionData = _getPositionData(sponsor);

    positionData.depositTo(
      globalPositionData,
      positionManagerData,
      FixedPoint.Unsigned(collateralAmount),
      sponsor
    );
  }

  /** @notice Check the collateralCurrency for a given self-minting derivative
   * @return collateral The collateral currency
   */
  function collateralCurrency()
    public
    view
    override
    returns (IERC20 collateral)
  {
    collateral = positionManagerData.collateralToken;
  }

  //----------------------------------------
  // Internal functions
  //----------------------------------------

  // TODO
  // /** @notice Gets the adjusted collateral after substracting fee
  //  * @return adjusted net collateral
  //  */
  // function _pfc()
  //   internal
  //   view
  //   virtual
  //
  //   returns (FixedPoint.Unsigned memory)
  // {
  //   return
  //     globalPositionData.rawTotalPositionCollateral.getFeeAdjustedCollateral(
  //       feePayerData.cumulativeFeeMultiplier
  //     );
  // }

  /** @notice Gets all data on a given sponsors position for a self-minting derivative
   * @param sponsor Address of the sponsor to check
   * @return A struct of information on a tokens sponsor position
   */
  function _getPositionData(address sponsor)
    internal
    view
    returns (PositionData storage)
  {
    return positions[sponsor];
  }
}
