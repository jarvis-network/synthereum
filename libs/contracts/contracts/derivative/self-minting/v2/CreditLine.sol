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
import {
  AccessControlEnumerable
} from '@openzeppelin/contracts/access/AccessControlEnumerable.sol';

/**
 * @title
 * @notice
 */
contract SynthereumCreditLine is
  AccessControlEnumerable,
  ICreditLine,
  ICreditLineStorage,
  Lockable
{
  using SafeMath for uint256;
  using FixedPoint for FixedPoint.Unsigned;
  using SafeERC20 for IERC20;
  using SafeERC20 for BaseControlledMintableBurnableERC20;
  using SynthereumCreditLineLib for PositionData;
  using SynthereumCreditLineLib for PositionManagerData;

  //----------------------------------------
  // Constants
  //----------------------------------------

  bytes32 public constant MAINTAINER_ROLE = keccak256('Maintainer');

  //----------------------------------------
  // Storage
  //----------------------------------------

  // Maps sponsor addresses to their positions. Each sponsor can have only one position.
  mapping(address => PositionData) public positions;
  // uint256 tokenSponsorsCount; // each new token sponsor will be identified with an incremental uint

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

  modifier onlyMaintainer() {
    require(
      hasRole(MAINTAINER_ROLE, msg.sender),
      'Sender must be the maintainer'
    );
    _;
  }

  modifier onlyCollateralisedPosition(address sponsor) {
    require(
      positions[sponsor].rawCollateral.isGreaterThan(0),
      'Position has no collateral'
    );
    _;
  }

  //----------------------------------------
  // Constructor
  //----------------------------------------

  constructor(
    PositionManagerParams memory _positionManagerData,
    Roles memory _roles
  ) nonReentrant {
    _setRoleAdmin(DEFAULT_ADMIN_ROLE, DEFAULT_ADMIN_ROLE);
    _setRoleAdmin(MAINTAINER_ROLE, DEFAULT_ADMIN_ROLE);
    _setupRole(DEFAULT_ADMIN_ROLE, _roles.admin);
    for (uint256 i = 0; i < _roles.maintainers.length; i++) {
      _setupRole(MAINTAINER_ROLE, _roles.maintainers[i]);
    }

    positionManagerData.synthereumFinder = _positionManagerData
      .synthereumFinder;
    positionManagerData.collateralToken = IStandardERC20(
      _positionManagerData.collateralAddress
    );
    positionManagerData.tokenCurrency = BaseControlledMintableBurnableERC20(
      _positionManagerData.tokenAddress
    );
    positionManagerData.minSponsorTokens = _positionManagerData
      .minSponsorTokens;
    positionManagerData.priceIdentifier = _positionManagerData
      .priceFeedIdentifier;
    positionManagerData.excessTokenBeneficiary = _positionManagerData
      .excessTokenBeneficiary;
    positionManagerData.version = _positionManagerData.version;
  }

  //----------------------------------------
  // External functions
  //----------------------------------------

  function deposit(uint256 collateralAmount)
    external
    override
    notEmergencyShutdown
  {
    PositionData storage positionData = _getPositionData(msg.sender);

    positionData.depositTo(
      globalPositionData,
      positionManagerData,
      FixedPoint.Unsigned(collateralAmount),
      msg.sender
    );
  }

  function withdraw(uint256 collateralAmount)
    external
    override
    notEmergencyShutdown
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

  function depositTo(address sponsor, uint256 collateralAmount)
    external
    override
    notEmergencyShutdown
    nonReentrant()
  {
    PositionData storage positionData = _getPositionData(sponsor);

    positionData.depositTo(
      globalPositionData,
      positionManagerData,
      FixedPoint.Unsigned(collateralAmount),
      sponsor
    );
  }

  function create(uint256 collateralAmount, uint256 numTokens)
    external
    override
    notEmergencyShutdown
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

  function redeem(uint256 numTokens)
    external
    override
    notEmergencyShutdown
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

  function repay(uint256 numTokens)
    external
    override
    notEmergencyShutdown
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

  function liquidate(address sponsor, uint256 maxTokensToLiquidate)
    external
    override
    notEmergencyShutdown
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
      FixedPoint.Unsigned(maxTokensToLiquidate)
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
      tokensLiquidated,
      collateralLiquidated,
      collateralReward,
      block.timestamp
    );
  }

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

  function emergencyShutdown()
    external
    override
    notEmergencyShutdown
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
    positionManagerData.emergencyShutdownPrice = positionManagerData
      ._getOraclePrice();

    emit EmergencyShutdown(
      msg.sender,
      positionManagerData.emergencyShutdownPrice.rawValue,
      positionManagerData.emergencyShutdownTimestamp
    );
  }

  function claimFee()
    external
    override
    nonReentrant
    returns (uint256 feeClaimed)
  {
    feeClaimed = positionManagerData.claimFee(feeStatus);
  }

  function getLiquidations(address sponsor)
    external
    view
    override
    nonReentrantView()
    returns (LiquidationData[] memory liquidationData)
  {
    liquidationData = liquidations[sponsor];
  }

  function getLiquidationData(address sponsor, uint256 liquidationId)
    external
    view
    override
    nonReentrantView()
    returns (LiquidationData memory liquidation)
  {
    LiquidationData[] memory liquidationArray = liquidations[sponsor];
    // Revert if the caller is attempting to access an invalid liquidation
    // (one that has never been created or one has never been initialized).
    require(liquidationId < liquidationArray.length, 'Invalid liquidation ID');
    liquidation = liquidationArray[liquidationId];
  }

  function getCapMintAmount() external view override returns (uint256 capMint) {
    capMint = positionManagerData.capMintAmount().rawValue;
  }

  function getFeeInfo() external view override returns (Fee memory fee) {
    fee = positionManagerData.feeInfo();
  }

  function getLiquidationReward()
    external
    view
    override
    returns (uint256 rewardPct)
  {
    rewardPct = positionManagerData.liquidationRewardPercentage().rawValue;
  }

  function getOvercollateralization()
    external
    view
    override
    returns (uint256 overcollateralizationPct)
  {
    overcollateralizationPct = positionManagerData
      .overCollateralization()
      .rawValue;
  }

  // /**
  //  * @notice Drains any excess balance of the provided ERC20 token to a pre-selected beneficiary.
  //  * @dev This will drain down to the amount of tracked collateral and drain the full balance of any other token.
  //  * @param token address of the ERC20 token whose excess balance should be drained.
  //  */
  function trimExcess(IERC20 token)
    external
    nonReentrant
    returns (uint256 amount)
  {
    amount = positionManagerData
      .trimExcess(globalPositionData, feeStatus, token)
      .rawValue;
  }

  function deleteSponsorPosition(address sponsor) external override {
    require(
      msg.sender == address(this),
      'Only the contract can invoke this function'
    );
    delete positions[sponsor];
  }

  function getPositionCollateral(address sponsor)
    external
    view
    override
    nonReentrantView()
    returns (FixedPoint.Unsigned memory collateralAmount)
  {
    return positions[sponsor].rawCollateral;
  }

  function synthereumFinder()
    external
    view
    override
    returns (ISynthereumFinder finder)
  {
    finder = positionManagerData.synthereumFinder;
  }

  function tokenCurrency() external view override returns (IERC20 synthToken) {
    synthToken = positionManagerData.tokenCurrency;
  }

  function collateralCurrency()
    public
    view
    override
    returns (IERC20 collateral)
  {
    collateral = positionManagerData.collateralToken;
  }

  function tokenCurrencySymbol()
    external
    view
    override
    returns (string memory symbol)
  {
    symbol = IStandardERC20(address(positionManagerData.tokenCurrency))
      .symbol();
  }

  function version() external view override returns (uint8 contractVersion) {
    contractVersion = positionManagerData.version;
  }

  function priceIdentifier()
    external
    view
    override
    returns (bytes32 identifier)
  {
    identifier = positionManagerData.priceIdentifier;
  }

  function totalTokensOutstanding()
    external
    view
    override
    returns (uint256 totalTokens)
  {
    totalTokens = globalPositionData.totalTokensOutstanding.rawValue;
  }

  function emergencyShutdownPrice()
    external
    view
    override
    isEmergencyShutdown()
    returns (uint256 price)
  {
    price = positionManagerData.emergencyShutdownPrice.rawValue;
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

  function _getPositionData(address sponsor)
    internal
    view
    onlyCollateralisedPosition(sponsor)
    returns (PositionData storage)
  {
    return positions[sponsor];
  }
}
