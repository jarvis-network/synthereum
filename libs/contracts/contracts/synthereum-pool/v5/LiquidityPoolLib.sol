// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.4;

import {
  ISynthereumLiquidityPoolStorage
} from './interfaces/ILiquidityPoolStorage.sol';
import {ISynthereumLiquidityPool} from './interfaces/ILiquidityPool.sol';
import {
  FixedPoint
} from '@uma/core/contracts/common/implementation/FixedPoint.sol';
import {IStandardERC20} from '../../base/interfaces/IStandardERC20.sol';
import {
  IMintableBurnableERC20
} from '../../tokens/interfaces/IMintableBurnableERC20.sol';
import {ISynthereumFinder} from '../../core/interfaces/IFinder.sol';
import {
  ISynthereumRegistry
} from '../../core/registries/interfaces/IRegistry.sol';
import {
  ISynthereumPriceFeed
} from '../../oracle/common/interfaces/IPriceFeed.sol';
import {
  ISynthereumLiquidityPoolGeneral
} from './interfaces/ILiquidityPoolGeneral.sol';
import {SynthereumInterfaces} from '../../core/Constants.sol';
import {
  SafeERC20
} from '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';

/**
 * @notice Pool implementation is stored here to reduce deployment costs
 */

library SynthereumLiquidityPoolLib {
  using FixedPoint for FixedPoint.Unsigned;
  using FixedPoint for uint256;
  using SafeERC20 for IStandardERC20;
  using SafeERC20 for IMintableBurnableERC20;
  using SynthereumLiquidityPoolLib for ISynthereumLiquidityPoolStorage.Storage;
  using SynthereumLiquidityPoolLib for ISynthereumLiquidityPoolStorage.LPPosition;
  using SynthereumLiquidityPoolLib for ISynthereumLiquidityPoolStorage.FeeStatus;

  struct ExecuteMintParams {
    // Amount of synth tokens to mint
    FixedPoint.Unsigned numTokens;
    // Amount of collateral (excluding fees) needed for mint
    FixedPoint.Unsigned collateralAmount;
    // Amount of fees of collateral user must pay
    FixedPoint.Unsigned feeAmount;
    // Amount of collateral equal to collateral minted + fees
    FixedPoint.Unsigned totCollateralAmount;
    // Recipient address that will receive synthetic tokens
    address recipient;
  }

  struct ExecuteRedeemParams {
    //Amount of synth tokens needed for redeem
    FixedPoint.Unsigned numTokens;
    // Amount of collateral that user will receive
    FixedPoint.Unsigned collateralAmount;
    // Amount of fees of collateral user must pay
    FixedPoint.Unsigned feeAmount;
    // Amount of collateral equal to collateral redeemed + fees
    FixedPoint.Unsigned totCollateralAmount;
    // Recipient address that will receive synthetic tokens
    address recipient;
  }

  struct ExecuteExchangeParams {
    // Destination pool in which mint new tokens
    ISynthereumLiquidityPoolGeneral destPool;
    // Amount of tokens to send
    FixedPoint.Unsigned numTokens;
    // Amount of collateral (excluding fees) equivalent to synthetic token (exluding fees) to send
    FixedPoint.Unsigned collateralAmount;
    // Amount of fees of collateral user must pay
    FixedPoint.Unsigned feeAmount;
    // Amount of collateral equal to collateral redemeed + fees
    FixedPoint.Unsigned totCollateralAmount;
    // Amount of synthetic token to receive
    FixedPoint.Unsigned destNumTokens;
    // Recipient address that will receive synthetic tokens
    address recipient;
  }

  struct ExecuteSettlement {
    // Price of emergency shutdown
    FixedPoint.Unsigned emergencyPrice;
    // Amount of synthtic tokens to be liquidated
    FixedPoint.Unsigned userNumTokens;
    // Total amount of collateral (excluding unused and fees) deposited
    FixedPoint.Unsigned totalCollateralAmount;
    // Total amount of synthetic tokens
    FixedPoint.Unsigned tokensCollaterlized;
    // Total actual amount of fees to be withdrawn
    FixedPoint.Unsigned totalFeeAmount;
    // Overcollateral to be withdrawn by Lp (0 if standard user)
    FixedPoint.Unsigned overCollateral;
    // Amount of collateral which value is equal to the synthetic tokens value according to the emergency price
    FixedPoint.Unsigned totalRedeemableCollateral;
    // Exepected amount of collateral
    FixedPoint.Unsigned redeemableCollateral;
    // Collateral deposited but not used to collateralize
    FixedPoint.Unsigned unusedCollateral;
    // Amount of collateral settled to the sender
    FixedPoint.Unsigned transferableCollateral;
  }

  //----------------------------------------
  // Events
  //----------------------------------------

  event Mint(
    address indexed account,
    uint256 collateralSent,
    uint256 numTokensReceived,
    uint256 feePaid,
    address recipient
  );

  event Redeem(
    address indexed account,
    uint256 numTokensSent,
    uint256 collateralReceived,
    uint256 feePaid,
    address recipient
  );

  event Exchange(
    address indexed account,
    address indexed destPool,
    uint256 numTokensSent,
    uint256 destNumTokensReceived,
    uint256 feePaid,
    address recipient
  );

  event SetFeePercentage(uint256 feePercentage);

  event SetFeeRecipients(address[] feeRecipients, uint32[] feeProportions);

  event WithdrawLiquidity(
    address indexed lp,
    uint256 liquidityWithdrawn,
    uint256 remainingLiquidity
  );

  event IncreaseCollateral(
    address indexed lp,
    uint256 collateralAdded,
    uint256 newTotalCollateral
  );

  event DecreaseCollateral(
    address indexed lp,
    uint256 collateralRemoved,
    uint256 newTotalCollateral
  );

  event ClaimFee(
    address indexed claimer,
    uint256 feeAmount,
    uint256 totalRemainingFees
  );

  event Liquidate(
    address indexed liquidator,
    uint256 tokensLiquidated,
    uint256 collateralReceived,
    uint256 rewardReceived
  );

  event EmergencyShutdown(uint256 timestamp, uint256 price);

  event Settlement(
    address indexed account,
    uint256 numTokensSettled,
    uint256 collateralExpected,
    uint256 collateralSettled
  );

  event SetOverCollateralization(uint256 overCollateralization);

  event SetLiquidationReward(uint256 liquidationReward);

  //----------------------------------------
  // External functions
  //----------------------------------------

  /**
   * @notice Initializes a liquidity pool
   * @param self Data type the library is attached to
   * @param liquidationData Liquidation info (see LiquidationData struct)
   * @param _finder The Synthereum finder
   * @param _version Synthereum version
   * @param _collateralToken ERC20 collateral token
   * @param _syntheticToken ERC20 synthetic token
   * @param _overCollateralization Over-collateralization ratio
   * @param _priceIdentifier Identifier of price to be used in the price feed
   * @param _collateralRequirement Percentage of overcollateralization to which a liquidation can triggered
   * @param _liquidationReward Percentage of reward for correct liquidation by a liquidator
   */
  function initialize(
    ISynthereumLiquidityPoolStorage.Storage storage self,
    ISynthereumLiquidityPoolStorage.Liquidation storage liquidationData,
    ISynthereumFinder _finder,
    uint8 _version,
    IStandardERC20 _collateralToken,
    IMintableBurnableERC20 _syntheticToken,
    FixedPoint.Unsigned calldata _overCollateralization,
    bytes32 _priceIdentifier,
    FixedPoint.Unsigned calldata _collateralRequirement,
    FixedPoint.Unsigned calldata _liquidationReward
  ) external {
    require(
      _collateralRequirement.isGreaterThan(1),
      'Collateral requirement must be bigger than 100%'
    );

    require(
      _overCollateralization.isGreaterThan(_collateralRequirement.sub(1)),
      'Overcollateralization must be bigger than the Lp part of the collateral requirement'
    );

    require(
      _liquidationReward.rawValue > 0 &&
        _liquidationReward.isLessThanOrEqual(1),
      'Liquidation reward must be between 0 and 100%'
    );

    require(
      _collateralToken.decimals() <= 18,
      'Collateral has more than 18 decimals'
    );

    require(
      _syntheticToken.decimals() == 18,
      'Synthetic token has more or less than 18 decimals'
    );

    ISynthereumPriceFeed priceFeed =
      ISynthereumPriceFeed(
        _finder.getImplementationAddress(SynthereumInterfaces.PriceFeed)
      );

    require(
      priceFeed.isPriceSupported(_priceIdentifier),
      'Price identifier not supported'
    );

    self.finder = _finder;
    self.version = _version;
    self.collateralToken = _collateralToken;
    self.syntheticToken = _syntheticToken;
    self.overCollateralization = _overCollateralization;
    self.priceIdentifier = _priceIdentifier;
    liquidationData.collateralRequirement = _collateralRequirement;
    liquidationData.liquidationReward = _liquidationReward;
  }

  /**
   * @notice Mint synthetic tokens using fixed amount of collateral
   * @notice This calculate the price using on chain price feed
   * @notice User must approve collateral transfer for the mint request to succeed
   * @param self Data type the library is attached to
   * @param lpPosition Position of the LP (see LPPosition struct)
   * @param feeStatus Actual status of fee gained (see FeeStatus struct)
   * @param mintParams Input parameters for minting (see MintParams struct)
   * @return syntheticTokensMinted Amount of synthetic tokens minted by a user
   * @return feePaid Amount of collateral paid by the user as fee
   */
  function mint(
    ISynthereumLiquidityPoolStorage.Storage storage self,
    ISynthereumLiquidityPoolStorage.LPPosition storage lpPosition,
    ISynthereumLiquidityPoolStorage.FeeStatus storage feeStatus,
    ISynthereumLiquidityPool.MintParams calldata mintParams
  ) external returns (uint256 syntheticTokensMinted, uint256 feePaid) {
    FixedPoint.Unsigned memory totCollateralAmount =
      FixedPoint.Unsigned(mintParams.collateralAmount);

    (
      FixedPoint.Unsigned memory collateralAmount,
      FixedPoint.Unsigned memory feeAmount,
      FixedPoint.Unsigned memory numTokens
    ) = self.mintCalculation(totCollateralAmount);

    require(
      numTokens.rawValue >= mintParams.minNumTokens,
      'Number of tokens less than minimum limit'
    );

    checkParams(self, mintParams.feePercentage, mintParams.expiration);

    self.executeMint(
      lpPosition,
      feeStatus,
      ExecuteMintParams(
        numTokens,
        collateralAmount,
        feeAmount,
        totCollateralAmount,
        mintParams.recipient
      )
    );

    syntheticTokensMinted = numTokens.rawValue;
    feePaid = feeAmount.rawValue;
  }

  /**
   * @notice Redeem amount of collateral using fixed number of synthetic token
   * @notice This calculate the price using on chain price feed
   * @notice User must approve synthetic token transfer for the redeem request to succeed
   * @param self Data type the library is attached to
   * @param lpPosition Position of the LP (see LPPosition struct)
   * @param feeStatus Actual status of fee gained (see FeeStatus struct)
   * @param redeemParams Input parameters for redeeming (see RedeemParams struct)
   * @return collateralRedeemed Amount of collateral redeeem by user
   * @return feePaid Amount of collateral paid by user as fee
   */
  function redeem(
    ISynthereumLiquidityPoolStorage.Storage storage self,
    ISynthereumLiquidityPoolStorage.LPPosition storage lpPosition,
    ISynthereumLiquidityPoolStorage.FeeStatus storage feeStatus,
    ISynthereumLiquidityPool.RedeemParams calldata redeemParams
  ) external returns (uint256 collateralRedeemed, uint256 feePaid) {
    FixedPoint.Unsigned memory numTokens =
      FixedPoint.Unsigned(redeemParams.numTokens);

    (
      FixedPoint.Unsigned memory totCollateralAmount,
      FixedPoint.Unsigned memory feeAmount,
      FixedPoint.Unsigned memory collateralAmount
    ) = self.redeemCalculation(numTokens);

    require(
      collateralAmount.rawValue >= redeemParams.minCollateral,
      'Collateral amount less than minimum limit'
    );

    checkParams(self, redeemParams.feePercentage, redeemParams.expiration);

    self.executeRedeem(
      lpPosition,
      feeStatus,
      ExecuteRedeemParams(
        numTokens,
        collateralAmount,
        feeAmount,
        totCollateralAmount,
        redeemParams.recipient
      )
    );

    feePaid = feeAmount.rawValue;
    collateralRedeemed = collateralAmount.rawValue;
  }

  /**
   * @notice Exchange a fixed amount of synthetic token of this pool, with an amount of synthetic tokens of an another pool
   * @notice This calculate the price using on chain price feed
   * @notice User must approve synthetic token transfer for the redeem request to succeed
   * @param self Data type the library is attached to
   * @param lpPosition Position of the LP (see LPPosition struct)
   * @param feeStatus Actual status of fee gained (see FeeStatus struct)
   * @param exchangeParams Input parameters for exchanging (see ExchangeParams struct)
   * @return destNumTokensMinted Amount of synthetic token minted in the destination pool
   * @return feePaid Amount of collateral paid by user as fee
   */
  function exchange(
    ISynthereumLiquidityPoolStorage.Storage storage self,
    ISynthereumLiquidityPoolStorage.LPPosition storage lpPosition,
    ISynthereumLiquidityPoolStorage.FeeStatus storage feeStatus,
    ISynthereumLiquidityPool.ExchangeParams calldata exchangeParams
  ) external returns (uint256 destNumTokensMinted, uint256 feePaid) {
    FixedPoint.Unsigned memory numTokens =
      FixedPoint.Unsigned(exchangeParams.numTokens);

    (
      FixedPoint.Unsigned memory totCollateralAmount,
      FixedPoint.Unsigned memory feeAmount,
      FixedPoint.Unsigned memory collateralAmount,
      FixedPoint.Unsigned memory destNumTokens
    ) = self.exchangeCalculation(numTokens, exchangeParams.destPool);

    require(
      destNumTokens.rawValue >= exchangeParams.minDestNumTokens,
      'Number of destination tokens less than minimum limit'
    );

    checkParams(self, exchangeParams.feePercentage, exchangeParams.expiration);

    self.executeExchange(
      lpPosition,
      feeStatus,
      ExecuteExchangeParams(
        exchangeParams.destPool,
        numTokens,
        collateralAmount,
        feeAmount,
        totCollateralAmount,
        destNumTokens,
        exchangeParams.recipient
      )
    );

    destNumTokensMinted = destNumTokens.rawValue;
    feePaid = feeAmount.rawValue;
  }

  /**
   * @notice Called by a source Pool's `exchange` function to mint destination tokens
   * @notice This functon can be called only by a pool registered in the deployer
   * @param self Data type the library is attached to
   * @param lpPosition Position of the LP (see LPPosition struct)
   * @param feeStatus Actual status of fee gained (see FeeStatus struct)
   * @param collateralAmount The amount of collateral to use from the source Pool
   * @param numTokens The number of new tokens to mint
   * @param recipient Recipient to which send synthetic token minted
   */
  function exchangeMint(
    ISynthereumLiquidityPoolStorage.Storage storage self,
    ISynthereumLiquidityPoolStorage.LPPosition storage lpPosition,
    ISynthereumLiquidityPoolStorage.FeeStatus storage feeStatus,
    FixedPoint.Unsigned calldata collateralAmount,
    FixedPoint.Unsigned calldata numTokens,
    address recipient
  ) external {
    self.checkPool(ISynthereumLiquidityPoolGeneral(msg.sender));

    // Sending amount must be different from 0
    require(
      collateralAmount.rawValue > 0,
      'Sending collateral amount is equal to 0'
    );

    // Collateral available
    FixedPoint.Unsigned memory unusedCollateral =
      self.calculateUnusedCollateral(
        lpPosition.totalCollateralAmount,
        feeStatus.totalFeeAmount,
        collateralAmount
      );

    // Update LP's collateralization status
    FixedPoint.Unsigned memory overCollateral =
      lpPosition.updateLpPositionInMint(
        self.overCollateralization,
        collateralAmount,
        numTokens
      );

    //Check there is enough liquidity in the pool for overcollateralization
    require(
      unusedCollateral.isGreaterThanOrEqual(overCollateral),
      'No enough liquidity for cover mint operation'
    );

    // Mint synthetic asset and transfer to the recipient
    self.syntheticToken.mint(recipient, numTokens.rawValue);
  }

  /**
   * @notice Withdraw unused deposited collateral by the LP
   * @param self Data type the library is attached to
   * @param lpPosition Position of the LP (see LPPosition struct)
   * @param feeStatus Actual status of fee gained (see FeeStatus struct)
   * @param collateralAmount Collateral to be withdrawn
   * @return remainingLiquidity Remaining unused collateral in the pool
   */
  function withdrawLiquidity(
    ISynthereumLiquidityPoolStorage.Storage storage self,
    ISynthereumLiquidityPoolStorage.LPPosition storage lpPosition,
    ISynthereumLiquidityPoolStorage.FeeStatus storage feeStatus,
    FixedPoint.Unsigned calldata collateralAmount
  ) external returns (uint256 remainingLiquidity) {
    remainingLiquidity = self._withdrawLiquidity(
      lpPosition,
      feeStatus,
      collateralAmount
    );
  }

  /**
   * @notice Increase collaterallization of Lp position
   * @notice Only a sender with LP role can call this function
   * @param self Data type the library is attached to
   * @param lpPosition Position of the LP (see LPPosition struct)
   * @param feeStatus Actual status of fee gained (see FeeStatus struct)
   * @param collateralToTransfer Collateral to be transferred before increase collateral in the position
   * @param collateralToIncrease Collateral to be added to the position
   * @return newTotalCollateral New total collateral amount
   */
  function increaseCollateral(
    ISynthereumLiquidityPoolStorage.Storage storage self,
    ISynthereumLiquidityPoolStorage.LPPosition storage lpPosition,
    ISynthereumLiquidityPoolStorage.FeeStatus storage feeStatus,
    FixedPoint.Unsigned calldata collateralToTransfer,
    FixedPoint.Unsigned calldata collateralToIncrease
  ) external returns (uint256 newTotalCollateral) {
    // Check the collateral to be increased is not 0
    require(collateralToIncrease.rawValue > 0, 'No collateral to be increased');

    // Deposit collateral in the pool
    if (collateralToTransfer.rawValue > 0) {
      self.pullCollateral(msg.sender, collateralToTransfer);
    }

    // Collateral available
    FixedPoint.Unsigned memory unusedCollateral =
      self.calculateUnusedCollateral(
        lpPosition.totalCollateralAmount,
        feeStatus.totalFeeAmount,
        FixedPoint.Unsigned(0)
      );

    // Check that there is enoush availabe collateral deposited in the pool
    require(
      unusedCollateral.isGreaterThanOrEqual(collateralToIncrease),
      'No enough liquidity for increasing collateral'
    );

    // Update new total collateral amount
    FixedPoint.Unsigned memory _newTotalCollateral =
      lpPosition.totalCollateralAmount.add(collateralToIncrease);

    lpPosition.totalCollateralAmount = _newTotalCollateral;

    newTotalCollateral = _newTotalCollateral.rawValue;

    emit IncreaseCollateral(
      msg.sender,
      collateralToIncrease.rawValue,
      newTotalCollateral
    );
  }

  /**
   * @notice Decrease collaterallization of Lp position
   * @notice Check that final position is not undercollateralized
   * @notice Only a sender with LP role can call this function
   * @param self Data type the library is attached to
   * @param lpPosition Position of the LP (see LPPosition struct)
   * @param liquidationData Liquidation info (see LiquidationData struct)
   * @param feeStatus Actual status of fee gained (see FeeStatus struct)
   * @param collateralToDecrease Collateral to decreased from the position
   * @param collateralToWithdraw Collateral to be transferred to the LP
   * @return newTotalCollateral New total collateral amount
   */
  function decreaseCollateral(
    ISynthereumLiquidityPoolStorage.Storage storage self,
    ISynthereumLiquidityPoolStorage.LPPosition storage lpPosition,
    ISynthereumLiquidityPoolStorage.Liquidation storage liquidationData,
    ISynthereumLiquidityPoolStorage.FeeStatus storage feeStatus,
    FixedPoint.Unsigned calldata collateralToDecrease,
    FixedPoint.Unsigned calldata collateralToWithdraw
  ) external returns (uint256 newTotalCollateral) {
    // Check that collateral to be decreased is not 0
    require(collateralToDecrease.rawValue > 0, 'No collateral to be decreased');

    // Resulting total collateral amount
    FixedPoint.Unsigned memory _newTotalCollateral =
      lpPosition.totalCollateralAmount.sub(collateralToDecrease);

    // Check that position doesn't become undercollateralized
    (bool _isOverCollateralized_, ) =
      self._isOverCollateralized(
        lpPosition,
        liquidationData,
        _newTotalCollateral
      );

    require(_isOverCollateralized_, 'Position undercollateralized');

    // Update new total collateral amount
    lpPosition.totalCollateralAmount = _newTotalCollateral;

    newTotalCollateral = _newTotalCollateral.rawValue;

    emit DecreaseCollateral(
      msg.sender,
      collateralToDecrease.rawValue,
      newTotalCollateral
    );

    if (collateralToWithdraw.rawValue > 0) {
      self._withdrawLiquidity(lpPosition, feeStatus, collateralToWithdraw);
    }
  }

  /**
   * @notice Withdraw fees gained by the sender
   * @param self Data type the library is attached to
   * @param feeStatus Actual status of fee gained (see FeeStatus struct)
   * @return feeClaimed Amount of fee claimed
   */
  function claimFee(
    ISynthereumLiquidityPoolStorage.Storage storage self,
    ISynthereumLiquidityPoolStorage.FeeStatus storage feeStatus
  ) external returns (uint256 feeClaimed) {
    // Fee to claim
    FixedPoint.Unsigned memory _feeClaimed = feeStatus.feeGained[msg.sender];
    feeClaimed = _feeClaimed.rawValue;

    // Check that fee is available
    require(_feeClaimed.isGreaterThanOrEqual(0), 'No fee to claim');

    // Update fee status
    delete feeStatus.feeGained[msg.sender];

    FixedPoint.Unsigned memory _totalRemainingFees =
      feeStatus.totalFeeAmount.sub(_feeClaimed);

    feeStatus.totalFeeAmount = _totalRemainingFees;

    // Transfer amount to the sender

    self.collateralToken.safeTransfer(msg.sender, feeClaimed);

    emit ClaimFee(msg.sender, feeClaimed, _totalRemainingFees.rawValue);
  }

  /**
   * @notice Liquidate Lp position for an amount of synthetic tokens undercollateralized
   * @notice Revert if position is not undercollateralized
   * @param self Data type the library is attached to
   * @param lpPosition Position of the LP (see LPPosition struct)
   * @param liquidationData Liquidation info (see LiquidationData struct)
   * @param feeStatus Actual status of fee gained (see FeeStatus struct)
   * @param numSynthTokens Number of synthetic tokens to be liquidated
   * @return collateralReceived Amount of received collateral equal to the value of tokens liquidated
   * @return rewardAmount Amount of received collateral as reward for the liquidation
   */
  function liquidate(
    ISynthereumLiquidityPoolStorage.Storage storage self,
    ISynthereumLiquidityPoolStorage.LPPosition storage lpPosition,
    ISynthereumLiquidityPoolStorage.Liquidation storage liquidationData,
    ISynthereumLiquidityPoolStorage.FeeStatus storage feeStatus,
    FixedPoint.Unsigned calldata numSynthTokens
  ) external returns (uint256 collateralReceived, uint256 rewardAmount) {
    // Collateral to liquidate
    FixedPoint.Unsigned memory collateralInLiquidation =
      lpPosition.updateLpPositionInRedeem(numSynthTokens);

    // Collateral value of the synthetic token passed
    (
      bool _isOverCollaterlized_,
      FixedPoint.Unsigned memory _collateralReceived
    ) =
      self._isOverCollateralized(
        lpPosition,
        liquidationData,
        collateralInLiquidation
      );

    // Revert if position is not undercollataralized
    require(!_isOverCollaterlized_, 'Position is not undercollataralized');

    // Burn synthetic tokens to be liquidated
    self.burnSyntheticTokens(numSynthTokens.rawValue);

    // Check that in case of undercapitalization there is enough unused liquidity
    if (collateralInLiquidation.isGreaterThan(_collateralReceived)) {
      rewardAmount = (collateralInLiquidation.sub(_collateralReceived))
        .mul(liquidationData.liquidationReward)
        .rawValue;
    } else if (
      _collateralReceived.sub(collateralInLiquidation).isGreaterThan(
        self.calculateUnusedCollateral(
          lpPosition.totalCollateralAmount,
          feeStatus.totalFeeAmount,
          FixedPoint.Unsigned(0)
        )
      )
    ) {
      revert('Not enough liquidity for liquidation');
    }

    //Send net amount of collateral to the user that submitted the redeem request
    self.collateralToken.safeTransfer(
      msg.sender,
      (_collateralReceived.add(rewardAmount)).rawValue
    );

    collateralReceived = _collateralReceived.rawValue;

    emit Liquidate(
      msg.sender,
      numSynthTokens.rawValue,
      collateralReceived,
      rewardAmount
    );
  }

  /**
   * @notice Shutdown the pool in case of emergency
   * @notice Only Synthereum manager contract can call this function
   * @param self Data type the library is attached to
   * @param emergencyShutdownData Emergency shutdown info (see Shutdown struct)
   * @return timestamp Timestamp of emergency shutdown transaction
   * @return price Price of the pair at the moment of shutdown execution
   */
  function emergencyShutdown(
    ISynthereumLiquidityPoolStorage.Storage storage self,
    ISynthereumLiquidityPoolStorage.Shutdown storage emergencyShutdownData
  ) external returns (uint256 timestamp, uint256 price) {
    ISynthereumFinder _finder = self.finder;

    require(
      msg.sender ==
        _finder.getImplementationAddress(SynthereumInterfaces.Manager),
      'Caller must be the Synthereum manager'
    );

    timestamp = block.timestamp;

    emergencyShutdownData.timestamp = timestamp;

    FixedPoint.Unsigned memory _price =
      getPriceFeedRate(_finder, self.priceIdentifier);

    emergencyShutdownData.price = _price;

    price = _price.rawValue;

    emit EmergencyShutdown(timestamp, price);
  }

  /**
   * @notice Redeem tokens after emergency shutdown
   * @param self Data type the library is attached to
   * @param lpPosition Position of the LP (see LPPosition struct)
   * @param feeStatus Actual status of fee gained (see FeeStatus struct)
   * @param emergencyShutdownData Emergency shutdown info (see Shutdown struct)
   * @param isLiquidityProvider True if the sender is an LP, otherwise false
   * @return synthTokensSettled Amount of synthetic tokens liquidated
   * @return amountSettled Amount of collateral withdrawn after emergency shutdown
   */
  function settleEmergencyShutdown(
    ISynthereumLiquidityPoolStorage.Storage storage self,
    ISynthereumLiquidityPoolStorage.LPPosition storage lpPosition,
    ISynthereumLiquidityPoolStorage.FeeStatus storage feeStatus,
    ISynthereumLiquidityPoolStorage.Shutdown storage emergencyShutdownData,
    bool isLiquidityProvider
  ) external returns (uint256 synthTokensSettled, uint256 amountSettled) {
    // Memory struct for saving local varibales
    ExecuteSettlement memory executeSettlement;

    IMintableBurnableERC20 syntheticToken = self.syntheticToken;

    executeSettlement.emergencyPrice = emergencyShutdownData.price;

    executeSettlement.userNumTokens = FixedPoint.Unsigned(
      syntheticToken.balanceOf(msg.sender)
    );

    // Make sure there is something for the user to settle
    uint256 _userNumTokens = executeSettlement.userNumTokens.rawValue;

    require(
      _userNumTokens > 0 || isLiquidityProvider,
      'Account has nothing to settle'
    );

    if (_userNumTokens > 0) {
      // Move synthetic tokens from the user to the pool
      // - This is because derivative expects the tokens to come from the sponsor address
      syntheticToken.safeTransferFrom(
        msg.sender,
        address(this),
        executeSettlement.userNumTokens.rawValue
      );
    }

    executeSettlement.totalCollateralAmount = lpPosition.totalCollateralAmount;
    executeSettlement.tokensCollaterlized = lpPosition.tokensCollateralized;
    executeSettlement.totalFeeAmount = feeStatus.totalFeeAmount;
    executeSettlement.overCollateral;

    uint256 scalingFactor =
      10**(18 - getCollateralDecimals(self.collateralToken));

    // Add overcollateral and deposited synthetic tokens if the sender is the LP
    if (isLiquidityProvider) {
      FixedPoint.Unsigned memory totalRedeemableCollateral =
        executeSettlement
          .tokensCollaterlized
          .mul(executeSettlement.emergencyPrice)
          .div(scalingFactor);

      executeSettlement.overCollateral = executeSettlement
        .totalCollateralAmount
        .isGreaterThan(totalRedeemableCollateral)
        ? executeSettlement.totalCollateralAmount.sub(totalRedeemableCollateral)
        : FixedPoint.Unsigned(0);

      executeSettlement.userNumTokens = FixedPoint.Unsigned(
        syntheticToken.balanceOf(address(this))
      );
    }

    // Calculate expected and settled collateral
    executeSettlement.redeemableCollateral = executeSettlement
      .userNumTokens
      .mul(executeSettlement.emergencyPrice)
      .div(scalingFactor)
      .add(executeSettlement.overCollateral);

    executeSettlement.unusedCollateral = self.calculateUnusedCollateral(
      executeSettlement.totalCollateralAmount,
      executeSettlement.totalFeeAmount,
      FixedPoint.Unsigned(0)
    );

    executeSettlement.transferableCollateral = FixedPoint.min(
      executeSettlement.redeemableCollateral,
      executeSettlement.totalCollateralAmount.add(
        executeSettlement.unusedCollateral
      )
    );

    // Update Lp position
    lpPosition.totalCollateralAmount = executeSettlement
      .totalCollateralAmount
      .isGreaterThan(executeSettlement.redeemableCollateral)
      ? executeSettlement.totalCollateralAmount.sub(
        executeSettlement.redeemableCollateral
      )
      : FixedPoint.Unsigned(0);

    lpPosition.tokensCollateralized = executeSettlement.tokensCollaterlized.sub(
      executeSettlement.userNumTokens
    );

    synthTokensSettled = executeSettlement.userNumTokens.rawValue;

    amountSettled = executeSettlement.transferableCollateral.rawValue;

    // Burn synthetic tokens
    syntheticToken.burn(synthTokensSettled);

    // Redeem the collateral for the underlying asset and transfer to the user
    self.collateralToken.safeTransfer(msg.sender, amountSettled);

    emit Settlement(
      msg.sender,
      synthTokensSettled,
      executeSettlement.redeemableCollateral.rawValue,
      amountSettled
    );
  }

  /**
   * @notice Update the fee percentage
   * @param self Data type the library is attached to
   * @param _feePercentage The new fee percentage
   */
  function setFeePercentage(
    ISynthereumLiquidityPoolStorage.Storage storage self,
    FixedPoint.Unsigned calldata _feePercentage
  ) external {
    require(
      _feePercentage.rawValue < 10**(18),
      'Fee Percentage must be less than 100%'
    );

    self.fee.feeData.feePercentage = _feePercentage;

    emit SetFeePercentage(_feePercentage.rawValue);
  }

  /**
   * @notice Update the addresses of recipients for generated fees and proportions of fees each address will receive
   * @param self Data type the library is attached to
   * @param _feeRecipients An array of the addresses of recipients that will receive generated fees
   * @param _feeProportions An array of the proportions of fees generated each recipient will receive
   */
  function setFeeRecipients(
    ISynthereumLiquidityPoolStorage.Storage storage self,
    address[] calldata _feeRecipients,
    uint32[] calldata _feeProportions
  ) external {
    require(
      _feeRecipients.length == _feeProportions.length,
      'Fee recipients and fee proportions do not match'
    );

    uint256 totalActualFeeProportions;

    // Store the sum of all proportions
    for (uint256 i = 0; i < _feeProportions.length; i++) {
      totalActualFeeProportions += _feeProportions[i];
    }

    ISynthereumLiquidityPoolStorage.FeeData storage _feeData = self.fee.feeData;

    _feeData.feeRecipients = _feeRecipients;
    _feeData.feeProportions = _feeProportions;
    self.fee.totalFeeProportions = totalActualFeeProportions;

    emit SetFeeRecipients(_feeRecipients, _feeProportions);
  }

  /**
   * @notice Update the overcollateralization percentage
   * @param self Data type the library is attached to
   * @param liquidationData Liquidation info (see LiquidationData struct)
   * @param _overCollateralization Overcollateralization percentage
   */
  function setOverCollateralization(
    ISynthereumLiquidityPoolStorage.Storage storage self,
    ISynthereumLiquidityPoolStorage.Liquidation storage liquidationData,
    FixedPoint.Unsigned calldata _overCollateralization
  ) external {
    require(
      _overCollateralization.isGreaterThan(
        liquidationData.collateralRequirement.sub(1)
      ),
      'Overcollateralization must be bigger than the Lp part of the collateral requirement'
    );

    self.overCollateralization = _overCollateralization;

    emit SetOverCollateralization(_overCollateralization.rawValue);
  }

  /**
   * @notice Update the liquidation reward percentage
   * @param liquidationData Liquidation info (see LiquidationData struct)
   * @param _liquidationReward Percentage of reward for correct liquidation by a liquidator
   */
  function setLiquidationReward(
    ISynthereumLiquidityPoolStorage.Liquidation storage liquidationData,
    FixedPoint.Unsigned calldata _liquidationReward
  ) external {
    require(
      _liquidationReward.rawValue > 0 &&
        _liquidationReward.isLessThanOrEqual(1),
      'Liquidation reward must be between 0 and 100%'
    );

    liquidationData.liquidationReward = _liquidationReward;

    emit SetLiquidationReward(_liquidationReward.rawValue);
  }

  //----------------------------------------
  // External view functions
  //----------------------------------------

  /**
   * @notice Returns the total amount of liquidity deposited in the pool, but nut used as collateral
   * @param self Data type the library is attached to
   * @param lpPosition Position of the LP (see LPPosition struct)
   * @param feeStatus Actual status of fee gained (see FeeStatus struct)
   * @return Total available liquidity
   */
  function totalAvailableLiquidity(
    ISynthereumLiquidityPoolStorage.Storage storage self,
    ISynthereumLiquidityPoolStorage.LPPosition storage lpPosition,
    ISynthereumLiquidityPoolStorage.FeeStatus storage feeStatus
  ) external view returns (uint256) {
    return
      self
        .calculateUnusedCollateral(
        lpPosition
          .totalCollateralAmount,
        feeStatus
          .totalFeeAmount,
        FixedPoint.Unsigned(0)
      )
        .rawValue;
  }

  /**
   * @notice Check if collateral is enough to collateralize the position
   * @param self Data type the library is attached to
   * @param lpPosition Position of the LP (see LPPosition struct)
   * @param liquidationData Liquidation info (see LiquidationData struct)
   * @return _isOverCollateralized_ True if position is overcollaterlized, otherwise false
   */
  function isOverCollateralized(
    ISynthereumLiquidityPoolStorage.Storage storage self,
    ISynthereumLiquidityPoolStorage.LPPosition storage lpPosition,
    ISynthereumLiquidityPoolStorage.Liquidation storage liquidationData
  ) external view returns (bool _isOverCollateralized_) {
    (_isOverCollateralized_, ) = self._isOverCollateralized(
      lpPosition,
      liquidationData,
      lpPosition.totalCollateralAmount
    );
  }

  /**
   * @notice Returns percentage of coverage of the collateral according to the last price
   * @param self Data type the library is attached to
   * @param lpPosition Position of the LP (see LPPosition struct)
   * @return Percentage of coverage (totalCollateralAmount / (price * tokensCollateralized))
   */
  function collateralCoverage(
    ISynthereumLiquidityPoolStorage.Storage storage self,
    ISynthereumLiquidityPoolStorage.LPPosition storage lpPosition
  ) external view returns (uint256) {
    return
      lpPosition
        .totalCollateralAmount
        .div(
        lpPosition.tokensCollateralized.mul(
          getPriceFeedRate(self.finder, self.priceIdentifier)
        )
      )
        .rawValue;
  }

  /**
   * @notice Returns the synthetic tokens will be received and fees will be paid in exchange for an input collateral amount
   * @notice This function is only trading-informative, it doesn't check liquidity and collateralization conditions
   * @param self Data type the library is attached to
   * @param inputCollateral Input collateral amount to be exchanged
   * @return synthTokensReceived Synthetic tokens will be minted
   * @return feePaid Collateral fee will be paid
   */
  function getMintTradeInfo(
    ISynthereumLiquidityPoolStorage.Storage storage self,
    FixedPoint.Unsigned calldata inputCollateral
  ) external view returns (uint256 synthTokensReceived, uint256 feePaid) {
    (
      ,
      FixedPoint.Unsigned memory _feePaid,
      FixedPoint.Unsigned memory _synthTokensReceived
    ) = self.mintCalculation(inputCollateral);

    synthTokensReceived = _synthTokensReceived.rawValue;
    feePaid = _feePaid.rawValue;
  }

  /**
   * @notice Returns the collateral amount will be received and fees will be paid in exchange for an input amount of synthetic tokens
   * @notice This function is only trading-informative, it doesn't check liquidity and collateralization conditions
   * @param self Data type the library is attached to
   * @param  syntheticTokens Amount of synthetic tokens to be exchanged
   * @return collateralAmountReceived Collateral amount will be received by the user
   * @return feePaid Collateral fee will be paid
   */
  function getRedeemTradeInfo(
    ISynthereumLiquidityPoolStorage.Storage storage self,
    FixedPoint.Unsigned calldata syntheticTokens
  ) external view returns (uint256 collateralAmountReceived, uint256 feePaid) {
    (
      ,
      FixedPoint.Unsigned memory _feePaid,
      FixedPoint.Unsigned memory _collateralAmountReceived
    ) = self.mintCalculation(syntheticTokens);

    collateralAmountReceived = _collateralAmountReceived.rawValue;
    feePaid = _feePaid.rawValue;
  }

  /**
   * @notice Returns the destination synthetic tokens amount will be received and fees will be paid in exchange for an input amount of synthetic tokens
   * @notice This function is only trading-informative, it doesn't check liquidity and collateralization conditions
   * @param self Data type the library is attached to
   * @param  syntheticTokens Amount of synthetic tokens to be exchanged
   * @param  destinationPool Pool in which mint the destination synthetic token
   * @return destSyntheticTokensReceived Synthetic tokens will be received from destination pool
   * @return feePaid Collateral fee will be paid
   */
  function getExchangeTradeInfo(
    ISynthereumLiquidityPoolStorage.Storage storage self,
    FixedPoint.Unsigned calldata syntheticTokens,
    ISynthereumLiquidityPoolGeneral destinationPool
  )
    external
    view
    returns (uint256 destSyntheticTokensReceived, uint256 feePaid)
  {
    self.checkPool(destinationPool);
    (
      ,
      FixedPoint.Unsigned memory _feePaid,
      ,
      FixedPoint.Unsigned memory _destSyntheticTokensReceived
    ) = self.exchangeCalculation(syntheticTokens, destinationPool);

    destSyntheticTokensReceived = _destSyntheticTokensReceived.rawValue;
    feePaid = _feePaid.rawValue;
  }

  //----------------------------------------
  //  Internal functions
  //----------------------------------------

  /**
   * @notice Execute mint of synthetic tokens
   * @param self Data type the library is attached to
   * @param lpPosition Position of the LP (see LPPosition struct)
   * @param feeStatus Actual status of fee gained (see FeeStatus struct)
   * @param executeMintParams Params for execution of mint (see ExecuteMintParams struct)
   */
  function executeMint(
    ISynthereumLiquidityPoolStorage.Storage storage self,
    ISynthereumLiquidityPoolStorage.LPPosition storage lpPosition,
    ISynthereumLiquidityPoolStorage.FeeStatus storage feeStatus,
    ExecuteMintParams memory executeMintParams
  ) internal {
    // Sending amount must be different from 0
    require(
      executeMintParams.collateralAmount.rawValue > 0,
      'Sending collateral amount is equal to 0'
    );

    // Collateral available
    FixedPoint.Unsigned memory unusedCollateral =
      self.calculateUnusedCollateral(
        lpPosition.totalCollateralAmount,
        feeStatus.totalFeeAmount,
        FixedPoint.Unsigned(0)
      );

    // Update LP's collateralization status
    FixedPoint.Unsigned memory overCollateral =
      lpPosition.updateLpPositionInMint(
        self.overCollateralization,
        executeMintParams.collateralAmount,
        executeMintParams.numTokens
      );

    //Check there is enough liquidity in the pool for overcollateralization
    require(
      unusedCollateral.isGreaterThanOrEqual(overCollateral),
      'No enough liquidity for covering mint operation'
    );

    // Update fees status
    feeStatus.updateFees(self.fee, executeMintParams.feeAmount);

    // Pull user's collateral
    self.pullCollateral(msg.sender, executeMintParams.totCollateralAmount);

    // Mint synthetic asset and transfer to the recipient
    self.syntheticToken.mint(
      executeMintParams.recipient,
      executeMintParams.numTokens.rawValue
    );

    emit Mint(
      msg.sender,
      executeMintParams.totCollateralAmount.rawValue,
      executeMintParams.numTokens.rawValue,
      executeMintParams.feeAmount.rawValue,
      executeMintParams.recipient
    );
  }

  /**
   * @notice Execute redeem of collateral
   * @param self Data type the library is attached tfo
   * @param lpPosition Position of the LP (see LPPosition struct)
   * @param feeStatus Actual status of fee gained (see FeeStatus struct)
   * @param executeRedeemParams Params for execution of redeem (see ExecuteRedeemParams struct)
   */
  function executeRedeem(
    ISynthereumLiquidityPoolStorage.Storage storage self,
    ISynthereumLiquidityPoolStorage.LPPosition storage lpPosition,
    ISynthereumLiquidityPoolStorage.FeeStatus storage feeStatus,
    ExecuteRedeemParams memory executeRedeemParams
  ) internal {
    // Sending amount must be different from 0
    require(
      executeRedeemParams.numTokens.rawValue > 0,
      'Sending tokens amount is equal to 0'
    );

    FixedPoint.Unsigned memory collateralRedeemed =
      lpPosition.updateLpPositionInRedeem(executeRedeemParams.numTokens);

    // Check that collateral redemeed is enough for cover the value of synthetic tokens
    require(
      collateralRedeemed.isGreaterThanOrEqual(
        executeRedeemParams.totCollateralAmount
      ),
      'Position undercapitalized'
    );

    // Update fees status
    feeStatus.updateFees(self.fee, executeRedeemParams.feeAmount);

    // Burn synthetic tokens
    self.burnSyntheticTokens(executeRedeemParams.numTokens.rawValue);

    //Send net amount of collateral to the user that submitted the redeem request
    self.collateralToken.safeTransfer(
      executeRedeemParams.recipient,
      executeRedeemParams.collateralAmount.rawValue
    );

    emit Redeem(
      msg.sender,
      executeRedeemParams.numTokens.rawValue,
      executeRedeemParams.collateralAmount.rawValue,
      executeRedeemParams.feeAmount.rawValue,
      executeRedeemParams.recipient
    );
  }

  /**
   * @notice Execute exchange between synthetic tokens
   * @param self Data type the library is attached tfo
   * @param lpPosition Position of the LP (see LPPosition struct)
   * @param feeStatus Actual status of fee gained (see FeeStatus struct)
   * @param executeExchangeParams Params for execution of exchange (see ExecuteExchangeParams struct)
   */
  function executeExchange(
    ISynthereumLiquidityPoolStorage.Storage storage self,
    ISynthereumLiquidityPoolStorage.LPPosition storage lpPosition,
    ISynthereumLiquidityPoolStorage.FeeStatus storage feeStatus,
    ExecuteExchangeParams memory executeExchangeParams
  ) internal {
    // Sending amount must be different from 0
    require(
      executeExchangeParams.numTokens.rawValue > 0,
      'Sending tokens amount is equal to 0'
    );

    FixedPoint.Unsigned memory collateralRedeemed =
      lpPosition.updateLpPositionInRedeem(executeExchangeParams.numTokens);

    // Check that collateral redemeed is enough for cover the value of synthetic tokens
    require(
      collateralRedeemed.isGreaterThanOrEqual(
        executeExchangeParams.totCollateralAmount
      ),
      'Position undercapitalized'
    );

    // Update fees status
    feeStatus.updateFees(self.fee, executeExchangeParams.feeAmount);

    // Burn synthetic tokens
    self.burnSyntheticTokens(executeExchangeParams.numTokens.rawValue);

    ISynthereumLiquidityPoolGeneral destinationPool =
      executeExchangeParams.destPool;

    // Check that destination pool is different from this pool
    require(
      address(this) != address(destinationPool),
      'Same source and destination pool'
    );

    self.checkPool(destinationPool);

    // Transfer collateral amount (without overcollateralization) to the destination pool
    self.collateralToken.safeTransfer(
      address(destinationPool),
      executeExchangeParams.collateralAmount.rawValue
    );

    // Mint the destination tokens with the withdrawn collateral
    destinationPool.exchangeMint(
      executeExchangeParams.collateralAmount.rawValue,
      executeExchangeParams.destNumTokens.rawValue,
      executeExchangeParams.recipient
    );

    emit Exchange(
      msg.sender,
      address(destinationPool),
      executeExchangeParams.numTokens.rawValue,
      executeExchangeParams.destNumTokens.rawValue,
      executeExchangeParams.feeAmount.rawValue,
      executeExchangeParams.recipient
    );
  }

  /**
   * @notice Withdraw unused deposited collateral by the LP
   * @param self Data type the library is attached to
   * @param lpPosition Position of the LP (see LPPosition struct)
   * @param feeStatus Actual status of fee gained (see FeeStatus struct)
   * @param collateralAmount Collateral to be withdrawn
   * @return remainingLiquidity Remaining unused collateral in the pool
   */
  function _withdrawLiquidity(
    ISynthereumLiquidityPoolStorage.Storage storage self,
    ISynthereumLiquidityPoolStorage.LPPosition storage lpPosition,
    ISynthereumLiquidityPoolStorage.FeeStatus storage feeStatus,
    FixedPoint.Unsigned memory collateralAmount
  ) internal returns (uint256 remainingLiquidity) {
    // Collateral available
    FixedPoint.Unsigned memory unusedCollateral =
      self.calculateUnusedCollateral(
        lpPosition.totalCollateralAmount,
        feeStatus.totalFeeAmount,
        FixedPoint.Unsigned(0)
      );

    // Check that available collateral is bigger than collateral to be withdrawn and returns the difference
    remainingLiquidity = (unusedCollateral.sub(collateralAmount)).rawValue;

    // Transfer amount to the Lp
    uint256 _collateralAmount = collateralAmount.rawValue;

    self.collateralToken.safeTransfer(msg.sender, _collateralAmount);

    emit WithdrawLiquidity(msg.sender, _collateralAmount, remainingLiquidity);
  }

  /**
   * @notice Update LP's collateralization status after a mint
   * @param lpPosition Position of the LP (see LPPosition struct)
   * @param overCollateralization Overcollateralization rate
   * @param collateralAmount Collateral amount to be added (only user collateral)
   * @param numTokens Tokens to be added
   * @return overCollateral Amount of collateral to be provided by LP for overcollateralization
   */
  function updateLpPositionInMint(
    ISynthereumLiquidityPoolStorage.LPPosition storage lpPosition,
    FixedPoint.Unsigned storage overCollateralization,
    FixedPoint.Unsigned memory collateralAmount,
    FixedPoint.Unsigned memory numTokens
  ) internal returns (FixedPoint.Unsigned memory overCollateral) {
    overCollateral = collateralAmount.mul(overCollateralization);

    lpPosition.totalCollateralAmount = lpPosition
      .totalCollateralAmount
      .add(collateralAmount)
      .add(overCollateral);

    lpPosition.tokensCollateralized = lpPosition.tokensCollateralized.add(
      numTokens
    );
  }

  /**
   * @notice Update LP's collateralization status after a redeem
   * @param lpPosition Position of the LP (see LPPosition struct)
   * @param numTokens Tokens to be removed
   * @return collateralRedeemed Collateral redeemed
   */
  function updateLpPositionInRedeem(
    ISynthereumLiquidityPoolStorage.LPPosition storage lpPosition,
    FixedPoint.Unsigned memory numTokens
  ) internal returns (FixedPoint.Unsigned memory collateralRedeemed) {
    FixedPoint.Unsigned memory totalActualTokens =
      lpPosition.tokensCollateralized;

    FixedPoint.Unsigned memory totalActualCollateral =
      lpPosition.totalCollateralAmount;

    FixedPoint.Unsigned memory fractionRedeemed =
      numTokens.div(totalActualTokens);

    collateralRedeemed = fractionRedeemed.mul(totalActualCollateral);

    lpPosition.tokensCollateralized = totalActualTokens.sub(numTokens);

    lpPosition.totalCollateralAmount = totalActualCollateral.sub(
      collateralRedeemed
    );
  }

  /**
   * @notice Update fee gained by the fee recipients
   * @param feeStatus Actual status of fee gained to be withdrawn
   * @param feeInfo Actual status of fee recipients and their proportions
   * @param feeAmount Collateral fee charged
   */
  function updateFees(
    ISynthereumLiquidityPoolStorage.FeeStatus storage feeStatus,
    ISynthereumLiquidityPoolStorage.Fee storage feeInfo,
    FixedPoint.Unsigned memory feeAmount
  ) internal {
    FixedPoint.Unsigned memory feeCharged;

    ISynthereumLiquidityPoolStorage.FeeData memory _feeData = feeInfo.feeData;

    uint256 _totalFeeProportions = feeInfo.totalFeeProportions;

    uint256 numberOfRecipients = _feeData.feeRecipients.length;

    mapping(address => FixedPoint.Unsigned) storage _feeGained =
      feeStatus.feeGained;

    for (uint256 i = 0; i < numberOfRecipients - 1; i++) {
      address feeRecipient = _feeData.feeRecipients[i];
      FixedPoint.Unsigned memory feeReceived =
        FixedPoint.Unsigned(
          (feeAmount.rawValue * _feeData.feeProportions[i]) /
            _totalFeeProportions
        );
      _feeGained[feeRecipient] = _feeGained[feeRecipient].add(feeReceived);
      feeCharged = feeCharged.add(feeReceived);
    }

    address lastRecipient = _feeData.feeRecipients[numberOfRecipients - 1];

    _feeGained[lastRecipient] = _feeGained[lastRecipient].add(feeAmount).sub(
      feeCharged
    );

    feeStatus.totalFeeAmount = feeStatus.totalFeeAmount.add(feeAmount);
  }

  /**
   * @notice Pulls collateral tokens from the sender to store in the Pool
   * @param self Data type the library is attached to
   * @param numTokens The number of tokens to pull
   */
  function pullCollateral(
    ISynthereumLiquidityPoolStorage.Storage storage self,
    address from,
    FixedPoint.Unsigned memory numTokens
  ) internal {
    self.collateralToken.safeTransferFrom(
      from,
      address(this),
      numTokens.rawValue
    );
  }

  /**
   * @notice Pulls synthetic tokens from the sender and burn them
   * @param self Data type the library is attached to
   * @param numTokens The number of tokens to be burned
   */
  function burnSyntheticTokens(
    ISynthereumLiquidityPoolStorage.Storage storage self,
    uint256 numTokens
  ) internal {
    IMintableBurnableERC20 synthToken = self.syntheticToken;

    // Transfer synthetic token from the user to the pool
    synthToken.safeTransferFrom(msg.sender, address(this), numTokens);

    // Burn synthetic asset
    synthToken.burn(numTokens);
  }

  //----------------------------------------
  //  Internal views functions
  //----------------------------------------

  /**
   * @notice Given a collateral value to be exchanged, returns the fee amount, net collateral and synthetic tokens
   * @param self Data type the library is attached tfo
   * @param totCollateralAmount Collateral amount to be exchanged
   * @return collateralAmount Net collateral amount (totCollateralAmount - feePercentage)
   * @return feeAmount Fee to be paid according to the fee percentage
   * @return numTokens Number of synthetic tokens will be received according to the actual price in exchange for collateralAmount
   */
  function mintCalculation(
    ISynthereumLiquidityPoolStorage.Storage storage self,
    FixedPoint.Unsigned memory totCollateralAmount
  )
    internal
    view
    returns (
      FixedPoint.Unsigned memory collateralAmount,
      FixedPoint.Unsigned memory feeAmount,
      FixedPoint.Unsigned memory numTokens
    )
  {
    feeAmount = totCollateralAmount.mul(self.fee.feeData.feePercentage);

    collateralAmount = totCollateralAmount.sub(feeAmount);

    numTokens = calculateNumberOfTokens(
      self.finder,
      self.collateralToken,
      self.priceIdentifier,
      collateralAmount
    );
  }

  /**
   * @notice Given a an amount of synthetic tokens to be exchanged, returns the fee amount, net collateral and gross collateral
   * @param self Data type the library is attached tfo
   * @param numTokens Synthetic tokens amount to be exchanged
   * @return totCollateralAmount Gross collateral amount (collateralAmount + feeAmount)
   * @return feeAmount Fee to be paid according to the fee percentage
   * @return collateralAmount Net collateral amount will be received according to the actual price in exchange for numTokens
   */
  function redeemCalculation(
    ISynthereumLiquidityPoolStorage.Storage storage self,
    FixedPoint.Unsigned memory numTokens
  )
    internal
    view
    returns (
      FixedPoint.Unsigned memory totCollateralAmount,
      FixedPoint.Unsigned memory feeAmount,
      FixedPoint.Unsigned memory collateralAmount
    )
  {
    totCollateralAmount = calculateCollateralAmount(
      self.finder,
      self.collateralToken,
      self.priceIdentifier,
      numTokens
    );

    feeAmount = totCollateralAmount.mul(self.fee.feeData.feePercentage);

    collateralAmount = totCollateralAmount.sub(feeAmount);
  }

  /**
   * @notice Given a an amount of synthetic tokens to be exchanged, returns the fee amount, net collateral and gross collateral and number of destination tokens
   * @param self Data type the library is attached tfo
   * @param numTokens Synthetic tokens amount to be exchanged
   * @param destinationPool Pool from which destination tokens will be received
   * @return totCollateralAmount Gross collateral amount according to the price
   * @return feeAmount Fee to be paid according to the fee percentage
   * @return collateralAmount Net collateral amount (totCollateralAmount - feeAmount)
   * @return destNumTokens Number of destination synthetic tokens will be received according to the actual price in exchange for synthetic tokens
   */
  function exchangeCalculation(
    ISynthereumLiquidityPoolStorage.Storage storage self,
    FixedPoint.Unsigned memory numTokens,
    ISynthereumLiquidityPoolGeneral destinationPool
  )
    internal
    view
    returns (
      FixedPoint.Unsigned memory totCollateralAmount,
      FixedPoint.Unsigned memory feeAmount,
      FixedPoint.Unsigned memory collateralAmount,
      FixedPoint.Unsigned memory destNumTokens
    )
  {
    totCollateralAmount = calculateCollateralAmount(
      self.finder,
      self.collateralToken,
      self.priceIdentifier,
      numTokens
    );

    feeAmount = totCollateralAmount.mul(self.fee.feeData.feePercentage);

    collateralAmount = totCollateralAmount.sub(feeAmount);

    destNumTokens = calculateNumberOfTokens(
      self.finder,
      self.collateralToken,
      destinationPool.getPriceFeedIdentifier(),
      collateralAmount
    );
  }

  /**
   * @notice Check fee percentage and expiration of mint, redeem and exchange transaction
   * @param self Data type the library is attached tfo
   * @param feePercentage Maximum percentage of fee that a user want to pay
   * @param expiration Expiration time of the transaction
   */
  function checkParams(
    ISynthereumLiquidityPoolStorage.Storage storage self,
    uint256 feePercentage,
    uint256 expiration
  ) internal view {
    require(block.timestamp <= expiration, 'Transaction expired');

    require(
      self.fee.feeData.feePercentage.rawValue <= feePercentage,
      'User fee percentage less than actual one'
    );
  }

  /**
   * @notice Check if sender or receiver pool is a correct registered pool
   * @param self Data type the library is attached to
   * @param poolToCheck Pool that should be compared with this pool
   */
  function checkPool(
    ISynthereumLiquidityPoolStorage.Storage storage self,
    ISynthereumLiquidityPoolGeneral poolToCheck
  ) internal view {
    IStandardERC20 collateralToken = self.collateralToken;
    require(
      collateralToken == poolToCheck.collateralToken(),
      'Collateral tokens do not match'
    );

    ISynthereumFinder finder = self.finder;

    require(finder == poolToCheck.synthereumFinder(), 'Finders do not match');

    ISynthereumRegistry poolRegister =
      ISynthereumRegistry(
        finder.getImplementationAddress(SynthereumInterfaces.PoolRegistry)
      );

    require(
      poolRegister.isDeployed(
        poolToCheck.syntheticTokenSymbol(),
        collateralToken,
        poolToCheck.version(),
        address(poolToCheck)
      ),
      'Destination pool not registered'
    );
  }

  /**
   * @notice Check if an amount of collateral is enough to collateralize the position
   * @param self Data type the library is attached to
   * @param lpPosition Position of the LP (see LPPosition struct)
   * @param liquidationData Liquidation info (see LiquidationData struct)
   * @param collateralToCompare collateral used for checking the overcollaterlization
   * @return _isOverCollateralized_ True if position is overcollaterlized, otherwise false
   * @return collateralValue Collateral amount equal to the value of tokens passed
   */
  function _isOverCollateralized(
    ISynthereumLiquidityPoolStorage.Storage storage self,
    ISynthereumLiquidityPoolStorage.LPPosition storage lpPosition,
    ISynthereumLiquidityPoolStorage.Liquidation storage liquidationData,
    FixedPoint.Unsigned memory collateralToCompare
  )
    internal
    view
    returns (
      bool _isOverCollateralized_,
      FixedPoint.Unsigned memory collateralValue
    )
  {
    collateralValue = calculateCollateralAmount(
      self.finder,
      self.collateralToken,
      self.priceIdentifier,
      lpPosition.tokensCollateralized
    );

    _isOverCollateralized_ = collateralToCompare.isGreaterThanOrEqual(
      collateralValue.mul(liquidationData.collateralRequirement)
    );
  }

  /**
   * @notice Calculate the unused collateral of this pool
   * @param self Data type the library is attached to
   * @param totalCollateral Total collateral used
   * @param totalFees Total fees gained to be whitdrawn
   * @param collateralReceived Collateral sent to the pool by a user or contract to be used for collateralization
   * @param unusedCollateral Unused collateral of the pool
   */
  function calculateUnusedCollateral(
    ISynthereumLiquidityPoolStorage.Storage storage self,
    FixedPoint.Unsigned memory totalCollateral,
    FixedPoint.Unsigned memory totalFees,
    FixedPoint.Unsigned memory collateralReceived
  ) internal view returns (FixedPoint.Unsigned memory unusedCollateral) {
    // Collateral available
    FixedPoint.Unsigned memory actualBalance =
      FixedPoint.Unsigned(self.collateralToken.balanceOf(address(this)));
    unusedCollateral = actualBalance.sub(
      totalCollateral.add(totalFees).add(collateralReceived)
    );
  }

  /**
   * @notice Calculate synthetic token amount starting from an amount of collateral, using on-chain oracle
   * @param finder Synthereum finder
   * @param collateralToken Collateral token contract
   * @param priceIdentifier Identifier of price pair
   * @param numTokens Amount of collateral from which you want to calculate synthetic token amount
   * @return numTokens Amount of tokens after on-chain oracle conversion
   */
  function calculateNumberOfTokens(
    ISynthereumFinder finder,
    IStandardERC20 collateralToken,
    bytes32 priceIdentifier,
    FixedPoint.Unsigned memory collateralAmount
  ) internal view returns (FixedPoint.Unsigned memory numTokens) {
    FixedPoint.Unsigned memory priceRate =
      getPriceFeedRate(finder, priceIdentifier);

    uint256 decimalsOfCollateral = getCollateralDecimals(collateralToken);

    numTokens = collateralAmount.mul(10**(18 - decimalsOfCollateral)).div(
      priceRate
    );
  }

  /**
   * @notice Calculate collateral amount starting from an amount of synthtic token, using on-chain oracle
   * @param finder Synthereum finder
   * @param collateralToken Collateral token contract
   * @param priceIdentifier Identifier of price pair
   * @param numTokens Amount of synthetic tokens from which you want to calculate collateral amount
   * @return collateralAmount Amount of collateral after on-chain oracle conversion
   */
  function calculateCollateralAmount(
    ISynthereumFinder finder,
    IStandardERC20 collateralToken,
    bytes32 priceIdentifier,
    FixedPoint.Unsigned memory numTokens
  ) internal view returns (FixedPoint.Unsigned memory collateralAmount) {
    FixedPoint.Unsigned memory priceRate =
      getPriceFeedRate(finder, priceIdentifier);

    uint256 decimalsOfCollateral = getCollateralDecimals(collateralToken);

    collateralAmount = numTokens.mul(priceRate).div(
      10**(18 - decimalsOfCollateral)
    );
  }

  /**
   * @notice Retrun the on-chain oracle price for a pair
   * @param finder Synthereum finder
   * @param priceIdentifier Identifier of price pair
   * @return priceRate Latest rate of the pair
   */
  function getPriceFeedRate(ISynthereumFinder finder, bytes32 priceIdentifier)
    internal
    view
    returns (FixedPoint.Unsigned memory priceRate)
  {
    ISynthereumPriceFeed priceFeed =
      ISynthereumPriceFeed(
        finder.getImplementationAddress(SynthereumInterfaces.PriceFeed)
      );

    priceRate = FixedPoint.Unsigned(priceFeed.getLatestPrice(priceIdentifier));
  }

  /**
   * @notice Retrun the number of decimals of collateral token
   * @param collateralToken Collateral token contract
   * @return decimals number of decimals
   */
  function getCollateralDecimals(IStandardERC20 collateralToken)
    internal
    view
    returns (uint256 decimals)
  {
    decimals = collateralToken.decimals();
  }
}
