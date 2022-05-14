// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity 0.8.9;

import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {IStandardERC20} from '../../base/interfaces/IStandardERC20.sol';
import {IMintableBurnableERC20} from '../../tokens/interfaces/IMintableBurnableERC20.sol';
import {ISynthereumFinder} from '../../core/interfaces/IFinder.sol';
import {ISynthereumPriceFeed} from '../../oracle/common/interfaces/IPriceFeed.sol';
import {ILendingManager} from '../../lending-module/interfaces/ILendingManager.sol';
import {ILendingStorageManager} from '../../lending-module/interfaces/ILendingStorageManager.sol';
import {ISynthereumMultiLpLiquidityPool} from './interfaces/IMultiLpLiquidityPool.sol';
import {ISynthereumMultiLpLiquidityPoolEvents} from './interfaces/IMultiLpLiquidityPoolEvents.sol';
import {SynthereumInterfaces} from '../../core/Constants.sol';
import {PreciseUnitMath} from '../../base/utils/PreciseUnitMath.sol';
import {EnumerableSet} from '@openzeppelin/contracts/utils/structs/EnumerableSet.sol';
import {SafeERC20} from '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import {ExplicitERC20} from '../../base/utils/ExplicitERC20.sol';

/**
 * @title Multi LP Synthereum pool lib
 */

library SynthereumMultiLpLiquidityPoolLib {
  using PreciseUnitMath for uint256;
  using SafeERC20 for IStandardERC20;
  using SafeERC20 for IMintableBurnableERC20;
  using ExplicitERC20 for IERC20;
  using EnumerableSet for EnumerableSet.AddressSet;

  struct PositionCache {
    // Address of the LP
    address lp;
    // Position of the LP
    ISynthereumMultiLpLiquidityPool.LPPosition lpPosition;
  }

  struct TempStorageArgs {
    uint256 price;
    uint256 totalSyntheticAsset;
    uint8 decimals;
  }

  struct TempInterstArgs {
    uint256 totalCapacity;
    uint256 totalUtilization;
    uint256 capacityShare;
    uint256 utilizationShare;
    uint256 interest;
    uint256 remainingInterest;
    bool isTotCapacityNotZero;
    bool isTotUtilizationNotZero;
  }

  struct SplitOperationArgs {
    ISynthereumMultiLpLiquidityPool.LPPosition lpPosition;
    uint256 remainingTokens;
    uint256 remainingFees;
    uint256 tokens;
    uint256 fees;
    BestShare bestShare;
  }

  struct BestShare {
    uint256 share;
    uint256 index;
  }

  struct LiquidationUpdateArgs {
    address liquidator;
    ILendingManager lendingManager;
    address liquidatedLp;
    uint256 tokensInLiquidation;
    uint256 overCollateralRequirement;
    TempStorageArgs tempStorageArgs;
    PositionCache lpCache;
    address lp;
    uint256 actualCollateralAmount;
    uint256 actualSynthTokens;
  }

  struct WithdrawDust {
    bool isPositive;
    uint256 amount;
  }

  struct PositionLPInfoArgs {
    uint256 price;
    uint256 poolInterest;
    uint256 collateralDeposited;
    uint256 totalSynthTokens;
    uint256 overCollateralLimit;
    uint256[] capacityShares;
    uint256 totalCapacity;
    uint256 tokensValue;
    uint256 maxCapacity;
    uint8 decimals;
  }

  // See IMultiLpLiquidityPoolEvents for events description
  event RegisteredLp(address indexed lp);

  event ActivatedLP(address indexed lp);

  event SetOvercollateralization(
    address indexed lp,
    uint256 overCollateralization
  );

  event DepositedLiquidity(
    address indexed lp,
    uint256 collateralSent,
    uint256 collateralDeposited
  );

  event WithdrawnLiquidity(
    address indexed lp,
    uint256 collateralWithdrawn,
    uint256 collateralReceived
  );

  event Minted(
    address indexed user,
    ISynthereumMultiLpLiquidityPoolEvents.MintValues mintvalues,
    address recipient
  );

  event Redeemed(
    address indexed user,
    ISynthereumMultiLpLiquidityPoolEvents.RedeemValues redeemvalues,
    address recipient
  );

  event Liquidated(
    address indexed user,
    address indexed lp,
    uint256 synthTokensInLiquidation,
    uint256 collateralAmount,
    uint256 bonusAmount,
    uint256 collateralReceived
  );

  event SetFeePercentage(uint256 newFee);

  event SetLiquidationReward(uint256 newLiquidationReward);

  event NewLendingModule(string lendingModuleId);

  /*

  /**
   * @notice Initialize pool
   * @param _storageParams Struct containing all storage variables of a pool (See Storage struct)
   * @param _params Params used for initialization (see InitializationParams struct)
   */
  function initialize(
    ISynthereumMultiLpLiquidityPool.Storage storage _storageParams,
    ISynthereumMultiLpLiquidityPool.InitializationParams calldata _params
  ) external {
    require(!_storageParams.isInitialized, 'Pool already initialized');
    require(
      _params.overCollateralRequirement > 0,
      'Overcollateral requirement must be bigger than 0%'
    );

    uint8 collTokenDecimals = _params.collateralToken.decimals();
    require(collTokenDecimals <= 18, 'Collateral has more than 18 decimals');

    require(
      _params.syntheticToken.decimals() == 18,
      'Synthetic token has more or less than 18 decimals'
    );

    ISynthereumPriceFeed priceFeed = ISynthereumPriceFeed(
      _params.finder.getImplementationAddress(SynthereumInterfaces.PriceFeed)
    );
    require(
      priceFeed.isPriceSupported(_params.priceIdentifier),
      'Price identifier not supported'
    );

    _storageParams.finder = _params.finder;
    _storageParams.poolVersion = _params.version;
    _storageParams.collateralAsset = _params.collateralToken;
    _storageParams.collateralDecimals = collTokenDecimals;
    _storageParams.syntheticAsset = _params.syntheticToken;
    _storageParams.priceIdentifier = _params.priceIdentifier;
    _storageParams.overCollateralRequirement = _params
      .overCollateralRequirement;

    _setLiquidationReward(_storageParams, _params.liquidationReward);
    _setFee(_storageParams, _params.fee);
    _setLendingModule(_storageParams, _params.lendingModuleId);

    _storageParams.isInitialized = true;
  }

  /**
   * @notice Register a liquidity provider to the LP's whitelist
   * @param _storageParams Struct containing all storage variables of a pool (See Storage struct)
   * @param _lp Address of the LP
   */
  function registerLP(
    ISynthereumMultiLpLiquidityPool.Storage storage _storageParams,
    address _lp
  ) external {
    require(_storageParams.registeredLPs.add(_lp), 'LP already registered');
    emit RegisteredLp(_lp);
  }

  /**
   * @notice Add the Lp to the active list of the LPs and initialize collateral and overcollateralization
   * @notice Only a registered and inactive LP can call this function to add himself
   * @param _storageParams Struct containing all storage variables of a pool (See Storage struct)
   * @param _collateralAmount Collateral amount to deposit by the LP
   * @param _overCollateralization Overcollateralization to set by the LP
   * @param _msgSender Transaction sender
   * @return collateralDeposited Net collateral deposited in the LP position
   */
  function activateLP(
    ISynthereumMultiLpLiquidityPool.Storage storage _storageParams,
    uint256 _collateralAmount,
    uint128 _overCollateralization,
    address _msgSender
  ) external returns (uint256 collateralDeposited) {
    require(
      _isRegisteredLP(_storageParams, _msgSender),
      'Sender must be a registered LP'
    );
    require(_collateralAmount > 0, 'No collateral deposited');
    require(
      _overCollateralization > _storageParams.overCollateralRequirement,
      'Overcollateralization must be bigger than overcollateral requirement'
    );

    ISynthereumFinder synthFinder = _storageParams.finder;
    ILendingManager.ReturnValues memory lendingValues = _lendingDeposit(
      _getLendingManager(synthFinder),
      _msgSender,
      _storageParams.collateralAsset,
      _collateralAmount
    );

    (PositionCache[] memory positionsCache, ) = _calculateNewPositions(
      _storageParams,
      lendingValues.poolInterest,
      _getPriceFeedRate(synthFinder, _storageParams.priceIdentifier),
      _storageParams.totalSyntheticAsset,
      lendingValues.prevTotalCollateral,
      _storageParams.collateralDecimals
    );

    _updateActualLPCollateral(_storageParams, positionsCache);

    collateralDeposited = lendingValues.tokensOut;
    _storageParams.lpPositions[_msgSender] = ISynthereumMultiLpLiquidityPool
      .LPPosition(collateralDeposited, 0, _overCollateralization);

    require(_storageParams.activeLPs.add(_msgSender), 'LP already active');

    emit ActivatedLP(_msgSender);
    emit DepositedLiquidity(_msgSender, _collateralAmount, collateralDeposited);
    emit SetOvercollateralization(_msgSender, _overCollateralization);
  }

  /**
   * @notice Add collateral to an active LP position
   * @notice Only an active LP can call this function to add collateral to his position
   * @param _storageParams Struct containing all storage variables of a pool (See Storage struct)
   * @param _collateralAmount Collateral amount to deposit by the LP
   * @param _msgSender Transaction sender
   * @return collateralDeposited Net collateral deposited in the LP position
   */
  function addLiquidity(
    ISynthereumMultiLpLiquidityPool.Storage storage _storageParams,
    uint256 _collateralAmount,
    address _msgSender
  ) external returns (uint256 collateralDeposited) {
    require(
      _isActiveLP(_storageParams, _msgSender),
      'Sender must be an active LP'
    );
    require(_collateralAmount > 0, 'No collateral added');

    ISynthereumFinder synthFinder = _storageParams.finder;
    ILendingManager.ReturnValues memory lendingValues = _lendingDeposit(
      _getLendingManager(synthFinder),
      _msgSender,
      _storageParams.collateralAsset,
      _collateralAmount
    );

    TempStorageArgs memory tempStorage = TempStorageArgs(
      _getPriceFeedRate(synthFinder, _storageParams.priceIdentifier),
      _storageParams.totalSyntheticAsset,
      _storageParams.collateralDecimals
    );

    (PositionCache[] memory positionsCache, ) = _calculateNewPositions(
      _storageParams,
      lendingValues.poolInterest,
      tempStorage.price,
      tempStorage.totalSyntheticAsset,
      lendingValues.prevTotalCollateral,
      tempStorage.decimals
    );

    collateralDeposited = lendingValues.tokensOut;
    _updateAndIncreaseActualLPCollateral(
      _storageParams,
      positionsCache,
      _msgSender,
      collateralDeposited
    );

    emit DepositedLiquidity(_msgSender, _collateralAmount, collateralDeposited);
  }

  /**
   * @notice Withdraw collateral from an active LP position
   * @notice Only an active LP can call this function to withdraw collateral from his position
   * @param _storageParams Struct containing all storage variables of a pool (See Storage struct)
   * @param _collateralAmount Collateral amount to withdraw by the LP
   * @param _msgSender Transaction sender
   * @return collateralReceived Collateral received from the withdrawal
   */
  function removeLiquidity(
    ISynthereumMultiLpLiquidityPool.Storage storage _storageParams,
    uint256 _collateralAmount,
    address _msgSender
  ) external returns (uint256 collateralReceived) {
    require(
      _isActiveLP(_storageParams, _msgSender),
      'Sender must be an active LP'
    );
    require(_collateralAmount > 0, 'No collateral withdrawn');

    ISynthereumFinder synthFinder = _storageParams.finder;
    (ILendingManager.ReturnValues memory lendingValues, ) = _lendingWithdraw(
      _getLendingManager(synthFinder),
      _msgSender,
      _collateralAmount
    );

    TempStorageArgs memory tempStorage = TempStorageArgs(
      _getPriceFeedRate(synthFinder, _storageParams.priceIdentifier),
      _storageParams.totalSyntheticAsset,
      _storageParams.collateralDecimals
    );

    (PositionCache[] memory positionsCache, ) = _calculateNewPositions(
      _storageParams,
      lendingValues.poolInterest,
      tempStorage.price,
      tempStorage.totalSyntheticAsset,
      lendingValues.prevTotalCollateral,
      tempStorage.decimals
    );

    _updateAndDecreaseActualLPCollateral(
      _storageParams,
      positionsCache,
      _msgSender,
      lendingValues.tokensOut,
      tempStorage.price,
      tempStorage.decimals
    );
    collateralReceived = lendingValues.tokensTransferred;

    emit WithdrawnLiquidity(
      _msgSender,
      lendingValues.tokensOut,
      collateralReceived
    );
  }

  /**
   * @notice Set the overCollateralization by an active LP
   * @notice This can be called only by an active LP
   * @param _storageParams Struct containing all storage variables of a pool (See Storage struct)
   * @param _overCollateralization New overCollateralizations
   */
  function setOvercollateralization(
    ISynthereumMultiLpLiquidityPool.Storage storage _storageParams,
    uint128 _overCollateralization,
    address _msgSender
  ) external {
    require(
      _isActiveLP(_storageParams, _msgSender),
      'Sender must be an active LP'
    );

    require(
      _overCollateralization > _storageParams.overCollateralRequirement,
      'Overcollateralization must be bigger than overcollateral requirement'
    );

    ISynthereumFinder synthFinder = _storageParams.finder;
    ILendingManager.ReturnValues memory lendingValues = _getLendingManager(
      synthFinder
    ).updateAccumulatedInterest();

    TempStorageArgs memory tempStorage = TempStorageArgs(
      _getPriceFeedRate(synthFinder, _storageParams.priceIdentifier),
      _storageParams.totalSyntheticAsset,
      _storageParams.collateralDecimals
    );

    (PositionCache[] memory positionsCache, ) = _calculateNewPositions(
      _storageParams,
      lendingValues.poolInterest,
      tempStorage.price,
      tempStorage.totalSyntheticAsset,
      lendingValues.prevTotalCollateral,
      tempStorage.decimals
    );

    _updateAndModifyActualLPOverCollateral(
      _storageParams,
      positionsCache,
      _msgSender,
      _overCollateralization,
      tempStorage.price,
      tempStorage.decimals
    );

    emit SetOvercollateralization(_msgSender, _overCollateralization);
  }

  /**
   * @notice Mint synthetic tokens using fixed amount of collateral
   * @notice This calculate the price using on chain price feed
   * @notice User must approve collateral transfer for the mint request to succeed
   * @param _storageParams Struct containing all storage variables of a pool (See Storage struct)
   * @param _mintParams Input parameters for minting (see MintParams struct)
   * @param _msgSender Transaction sender
   * @return Amount of synthetic tokens minted by a user
   * @return Amount of collateral paid by the user as fee
   */
  function mint(
    ISynthereumMultiLpLiquidityPool.Storage storage _storageParams,
    ISynthereumMultiLpLiquidityPool.MintParams calldata _mintParams,
    address _msgSender
  ) external returns (uint256, uint256) {
    require(_mintParams.collateralAmount > 0, 'No collateral sent');

    ISynthereumFinder synthFinder = _storageParams.finder;
    ILendingManager.ReturnValues memory lendingValues = _lendingDeposit(
      _getLendingManager(synthFinder),
      _msgSender,
      _storageParams.collateralAsset,
      _mintParams.collateralAmount
    );

    TempStorageArgs memory tempStorage = TempStorageArgs(
      _getPriceFeedRate(synthFinder, _storageParams.priceIdentifier),
      _storageParams.totalSyntheticAsset,
      _storageParams.collateralDecimals
    );

    (PositionCache[] memory positionsCache, ) = _calculateNewPositions(
      _storageParams,
      lendingValues.poolInterest,
      tempStorage.price,
      tempStorage.totalSyntheticAsset,
      lendingValues.prevTotalCollateral,
      tempStorage.decimals
    );

    ISynthereumMultiLpLiquidityPoolEvents.MintValues
      memory mintValues = _calculateMint(
        _storageParams,
        lendingValues.tokensOut,
        tempStorage.price,
        tempStorage.decimals
      );

    require(
      mintValues.numTokens >= _mintParams.minNumTokens,
      'Number of tokens less than minimum limit'
    );

    _calculateMintTokensAndFee(
      mintValues,
      tempStorage.price,
      tempStorage.decimals,
      positionsCache
    );

    _updateActualLPPositions(_storageParams, positionsCache);

    _storageParams.totalSyntheticAsset =
      tempStorage.totalSyntheticAsset +
      mintValues.numTokens;

    _storageParams.syntheticAsset.mint(
      _mintParams.recipient,
      mintValues.numTokens
    );

    mintValues.totalCollateral = _mintParams.collateralAmount;

    emit Minted(_msgSender, mintValues, _mintParams.recipient);

    return (mintValues.numTokens, mintValues.feeAmount);
  }

  /**
   * @notice Redeem amount of collateral using fixed number of synthetic token
   * @notice This calculate the price using on chain price feed
   * @notice User must approve synthetic token transfer for the redeem request to succeed
   * @param _storageParams Struct containing all storage variables of a pool (See Storage struct)
   * @param _redeemParams Input parameters for redeeming (see RedeemParams struct)
   * @param _msgSender Transaction sender
   * @return Amount of collateral redeemed by user
   * @return Amount of collateral paid by user as fee
   */
  function redeem(
    ISynthereumMultiLpLiquidityPool.Storage storage _storageParams,
    ISynthereumMultiLpLiquidityPool.RedeemParams calldata _redeemParams,
    address _msgSender
  ) external returns (uint256, uint256) {
    require(_redeemParams.numTokens > 0, 'No tokens sent');

    ISynthereumFinder synthFinder = _storageParams.finder;

    TempStorageArgs memory tempStorage = TempStorageArgs(
      _getPriceFeedRate(synthFinder, _storageParams.priceIdentifier),
      _storageParams.totalSyntheticAsset,
      _storageParams.collateralDecimals
    );

    ISynthereumMultiLpLiquidityPoolEvents.RedeemValues
      memory redeemValues = _calculateRedeem(
        _storageParams,
        _redeemParams.numTokens,
        tempStorage.price,
        tempStorage.decimals
      );

    (
      ILendingManager.ReturnValues memory lendingValues,
      WithdrawDust memory withdrawDust
    ) = _lendingWithdraw(
        _getLendingManager(synthFinder),
        _redeemParams.recipient,
        redeemValues.collateralAmount
      );

    (PositionCache[] memory positionsCache, ) = _calculateNewPositions(
      _storageParams,
      lendingValues.poolInterest,
      tempStorage.price,
      tempStorage.totalSyntheticAsset,
      lendingValues.prevTotalCollateral,
      tempStorage.decimals
    );

    require(
      lendingValues.tokensTransferred >= _redeemParams.minCollateral,
      'Collateral amount less than minimum limit'
    );

    _calculateRedeemTokensAndFee(
      tempStorage.totalSyntheticAsset,
      _redeemParams.numTokens,
      redeemValues.feeAmount,
      withdrawDust,
      positionsCache
    );

    _updateActualLPPositions(_storageParams, positionsCache);

    _storageParams.totalSyntheticAsset =
      tempStorage.totalSyntheticAsset -
      _redeemParams.numTokens;

    _burnSyntheticTokens(
      _storageParams.syntheticAsset,
      _redeemParams.numTokens,
      _msgSender
    );

    redeemValues.collateralAmount = lendingValues.tokensTransferred;

    emit Redeemed(_msgSender, redeemValues, _redeemParams.recipient);

    return (redeemValues.collateralAmount, redeemValues.feeAmount);
  }

  /**
   * @notice Liquidate Lp position for an amount of synthetic tokens undercollateralized
   * @notice Revert if position is not undercollateralized
   * @param _storageParams Struct containing all storage variables of a pool (See Storage struct)
   * @param _lp LP that the the user wants to liquidate
   * @param _numSynthTokens Number of synthetic tokens that user wants to liquidate
   * @param _liquidator Liquidator of the LP position
   * @return Amount of collateral received (Amount of collateral + bonus)
   */
  function liquidate(
    ISynthereumMultiLpLiquidityPool.Storage storage _storageParams,
    address _lp,
    uint256 _numSynthTokens,
    address _liquidator
  ) external returns (uint256) {
    LiquidationUpdateArgs memory liquidationUpdateArgs;
    liquidationUpdateArgs.liquidator = _liquidator;

    require(_isActiveLP(_storageParams, _lp), 'LP is not active');

    ISynthereumFinder synthFinder = _storageParams.finder;

    liquidationUpdateArgs.tempStorageArgs = TempStorageArgs(
      _getPriceFeedRate(synthFinder, _storageParams.priceIdentifier),
      _storageParams.totalSyntheticAsset,
      _storageParams.collateralDecimals
    );

    liquidationUpdateArgs.lendingManager = _getLendingManager(synthFinder);
    liquidationUpdateArgs.overCollateralRequirement = _storageParams
      .overCollateralRequirement;

    (uint256 poolInterest, uint256 collateralDeposited) = _getLendingInterest(
      liquidationUpdateArgs.lendingManager
    );

    (PositionCache[] memory positionsCache, ) = _calculateNewPositions(
      _storageParams,
      poolInterest,
      liquidationUpdateArgs.tempStorageArgs.price,
      liquidationUpdateArgs.tempStorageArgs.totalSyntheticAsset,
      collateralDeposited,
      liquidationUpdateArgs.tempStorageArgs.decimals
    );

    (
      uint256 tokensInLiquidation,
      uint256 collateralAmount,
      uint256 bonusAmount,
      uint256 collateralReceived
    ) = _updateAndLiquidate(
        _storageParams,
        positionsCache,
        _lp,
        _numSynthTokens,
        liquidationUpdateArgs
      );

    _storageParams.totalSyntheticAsset =
      liquidationUpdateArgs.tempStorageArgs.totalSyntheticAsset -
      tokensInLiquidation;

    _burnSyntheticTokens(
      _storageParams.syntheticAsset,
      tokensInLiquidation,
      _liquidator
    );

    emit Liquidated(
      _liquidator,
      _lp,
      tokensInLiquidation,
      collateralAmount,
      bonusAmount,
      collateralReceived
    );

    return collateralReceived;
  }

  /**
   * @notice Update interests and positions ov every LP
   * @notice Everyone can call this function
   * @param _storageParams Struct containing all storage variables of a pool (See Storage struct)
   */
  function updatePositions(
    ISynthereumMultiLpLiquidityPool.Storage storage _storageParams
  ) external {
    ISynthereumFinder synthFinder = _storageParams.finder;
    ILendingManager.ReturnValues memory lendingValues = _getLendingManager(
      synthFinder
    ).updateAccumulatedInterest();

    (PositionCache[] memory positionsCache, ) = _calculateNewPositions(
      _storageParams,
      lendingValues.poolInterest,
      _getPriceFeedRate(synthFinder, _storageParams.priceIdentifier),
      _storageParams.totalSyntheticAsset,
      lendingValues.prevTotalCollateral,
      _storageParams.collateralDecimals
    );

    _updateActualLPPositions(_storageParams, positionsCache);
  }

  /**
   * @notice Transfer a bearing amount to the lending manager
   * @notice Only the lending manager can call the function
   * @param _storageParams Struct containing all storage variables of a pool (See Storage struct)
   * @param _bearingAmount Amount of bearing token to transfer
   * @return bearingAmountOut Real bearing amount transferred to the lending manager
   */
  function transferToLendingManager(
    ISynthereumMultiLpLiquidityPool.Storage storage _storageParams,
    uint256 _bearingAmount
  ) external returns (uint256 bearingAmountOut) {
    ISynthereumFinder synthFinder = _storageParams.finder;
    ILendingManager lendingManager = _getLendingManager(synthFinder);
    require(
      msg.sender == address(lendingManager),
      'Sender must be lending manager'
    );

    (uint256 poolInterest, uint256 totalActualCollateral) = _getLendingInterest(
      lendingManager
    );

    (PositionCache[] memory positionsCache, ) = _calculateNewPositions(
      _storageParams,
      poolInterest,
      _getPriceFeedRate(synthFinder, _storageParams.priceIdentifier),
      _storageParams.totalSyntheticAsset,
      totalActualCollateral,
      _storageParams.collateralDecimals
    );

    _updateActualLPPositions(_storageParams, positionsCache);

    (uint256 poolBearingValue, address bearingToken) = lendingManager
      .collateralToInterestToken(
        address(this),
        totalActualCollateral + poolInterest
      );

    (uint256 amountOut, uint256 remainingBearingValue) = IERC20(bearingToken)
      .explicitSafeTransfer(msg.sender, _bearingAmount);

    require(remainingBearingValue >= poolBearingValue, 'Unfunded pool');

    bearingAmountOut = amountOut;
  }

  /**
   * @notice Set new liquidation reward percentage
   * @param _storageParams Struct containing all storage variables of a pool (See Storage struct)
   * @param _newLiquidationReward New liquidation reward percentage
   */
  function setLiquidationReward(
    ISynthereumMultiLpLiquidityPool.Storage storage _storageParams,
    uint64 _newLiquidationReward
  ) external {
    _setLiquidationReward(_storageParams, _newLiquidationReward);
  }

  /**
   * @notice Set new fee percentage
   * @param _storageParams Struct containing all storage variables of a pool (See Storage struct)
   * @param _newFee New fee percentage
   */
  function setFee(
    ISynthereumMultiLpLiquidityPool.Storage storage _storageParams,
    uint64 _newFee
  ) external {
    _setFee(_storageParams, _newFee);
  }

  /**
   * @notice Set new lending protocol for this pool
   * @param _storageParams Struct containing all storage variables of a pool (See Storage struct)
   * @param _lendingId Name of the new lending module
   * @param _bearingToken Token of the lending mosule to be used for intersts accrual
            (used only if the lending manager doesn't automatically find the one associated to the collateral fo this pool)
   */
  function switchLendingModule(
    ISynthereumMultiLpLiquidityPool.Storage storage _storageParams,
    string calldata _lendingId,
    address _bearingToken
  ) external {
    ISynthereumFinder synthFinder = _storageParams.finder;
    ILendingManager.MigrateReturnValues
      memory migrationValues = _lendingMigration(
        _getLendingManager(synthFinder),
        _getLendingStorageManager(synthFinder),
        _lendingId,
        _bearingToken
      );

    TempStorageArgs memory tempStorage = TempStorageArgs(
      _getPriceFeedRate(synthFinder, _storageParams.priceIdentifier),
      _storageParams.totalSyntheticAsset,
      _storageParams.collateralDecimals
    );

    (
      PositionCache[] memory positionsCache,
      uint256 prevTotalLpsCollateral
    ) = _calculateNewPositions(
        _storageParams,
        migrationValues.poolInterest,
        tempStorage.price,
        tempStorage.totalSyntheticAsset,
        migrationValues.prevTotalCollateral,
        tempStorage.decimals
      );

    _calculateLendingModuleCollateral(
      prevTotalLpsCollateral,
      migrationValues,
      positionsCache
    );

    _updateActualLPPositions(_storageParams, positionsCache);

    _setLendingModule(_storageParams, _lendingId);
  }

  /**
   * @notice Get all the registered LPs of this pool
   * @param _storageParams Struct containing all storage variables of a pool (See Storage struct)
   * @return The list of addresses of all the registered LPs in the pool.
   */
  function getRegisteredLPs(
    ISynthereumMultiLpLiquidityPool.Storage storage _storageParams
  ) external view returns (address[] memory) {
    uint256 numberOfLPs = _storageParams.registeredLPs.length();
    address[] memory lpList = new address[](numberOfLPs);
    for (uint256 j = 0; j < numberOfLPs; j++) {
      lpList[j] = _storageParams.registeredLPs.at(j);
    }
    return lpList;
  }

  /**
   * @notice Get all the active LPs of this pool
   * @param _storageParams Struct containing all storage variables of a pool (See Storage struct)
   * @return The list of addresses of all the active LPs in the pool.
   */
  function getActiveLPs(
    ISynthereumMultiLpLiquidityPool.Storage storage _storageParams
  ) external view returns (address[] memory) {
    uint256 numberOfLPs = _storageParams.activeLPs.length();
    address[] memory lpList = new address[](numberOfLPs);
    for (uint256 j = 0; j < numberOfLPs; j++) {
      lpList[j] = _storageParams.activeLPs.at(j);
    }
    return lpList;
  }

  /**
   * @notice Returns the total amounts of collateral
   * @param _storageParams Struct containing all storage variables of a pool (See Storage struct)
   * @return usersCollateral Total collateral amount currently holded by users
   * @return lpsCollateral Total collateral amount currently holded by LPs
   * @return totalCollateral Total collateral amount currently holded by users + LPs
   */
  function totalCollateralAmount(
    ISynthereumMultiLpLiquidityPool.Storage storage _storageParams
  )
    external
    view
    returns (
      uint256 usersCollateral,
      uint256 lpsCollateral,
      uint256 totalCollateral
    )
  {
    ISynthereumFinder synthFinder = _storageParams.finder;
    usersCollateral = _calculateCollateralAmount(
      _storageParams.totalSyntheticAsset,
      _getPriceFeedRate(synthFinder, _storageParams.priceIdentifier),
      _storageParams.collateralDecimals
    );

    (uint256 poolInterest, uint256 totalActualCollateral) = _getLendingInterest(
      _getLendingManager(synthFinder)
    );

    totalCollateral = totalActualCollateral + poolInterest;

    lpsCollateral = totalCollateral - usersCollateral;
  }

  /**
   * @notice Returns the max capacity in synth assets of all the LPs
   * @param _storageParams Struct containing all storage variables of a pool (See Storage struct)
   * @return maxCapacity Total max capacity of the pool
   */
  function maxTokensCapacity(
    ISynthereumMultiLpLiquidityPool.Storage storage _storageParams
  ) external view returns (uint256 maxCapacity) {
    ISynthereumFinder synthFinder = _storageParams.finder;
    uint256 price = _getPriceFeedRate(
      synthFinder,
      _storageParams.priceIdentifier
    );

    (uint256 poolInterest, uint256 collateralDeposited) = _getLendingInterest(
      _getLendingManager(synthFinder)
    );

    uint8 decimals = _storageParams.collateralDecimals;
    (PositionCache[] memory positionsCache, ) = _calculateNewPositions(
      _storageParams,
      poolInterest,
      price,
      _storageParams.totalSyntheticAsset,
      collateralDeposited,
      decimals
    );

    ISynthereumMultiLpLiquidityPool.LPPosition memory lpPosition;
    for (uint256 j = 0; j < positionsCache.length; j++) {
      lpPosition = positionsCache[j].lpPosition;
      uint256 lpCapacity = _calculateCapacity(lpPosition, price, decimals);
      maxCapacity += lpCapacity;
    }
  }

  /**
   * @notice Returns the lending protocol info
   * @param _storageParams Struct containing all storage variables of a pool (See Storage struct)
   * @return lendingId Name of the lending module
   * @return bearingToken Address of the bearing token held by the pool for interest accrual
   */
  function lendingProtocolInfo(
    ISynthereumMultiLpLiquidityPool.Storage storage _storageParams
  ) external view returns (string memory lendingId, address bearingToken) {
    lendingId = _storageParams.lendingModuleId;
    bearingToken = _getLendingStorageManager(_storageParams.finder)
      .getInterestBearingToken(address(this));
  }

  /**
   * @notice Returns the LP parametrs info
   * @param _storageParams Struct containing all storage variables of a pool (See Storage struct)
   * @param _lp Address of the LP
   * @return info Info of the input LP (see LPInfo struct)
   */
  function positionLPInfo(
    ISynthereumMultiLpLiquidityPool.Storage storage _storageParams,
    address _lp
  ) external view returns (ISynthereumMultiLpLiquidityPool.LPInfo memory info) {
    require(_isActiveLP(_storageParams, _lp), 'LP not active');

    ISynthereumFinder synthFinder = _storageParams.finder;
    PositionLPInfoArgs memory positionLPInfoArgs;
    positionLPInfoArgs.price = _getPriceFeedRate(
      synthFinder,
      _storageParams.priceIdentifier
    );

    (
      positionLPInfoArgs.poolInterest,
      positionLPInfoArgs.collateralDeposited
    ) = _getLendingInterest(_getLendingManager(synthFinder));

    positionLPInfoArgs.totalSynthTokens = _storageParams.totalSyntheticAsset;

    positionLPInfoArgs.decimals = _storageParams.collateralDecimals;
    (PositionCache[] memory positionsCache, ) = _calculateNewPositions(
      _storageParams,
      positionLPInfoArgs.poolInterest,
      positionLPInfoArgs.price,
      positionLPInfoArgs.totalSynthTokens,
      positionLPInfoArgs.collateralDeposited,
      positionLPInfoArgs.decimals
    );

    positionLPInfoArgs.overCollateralLimit = _storageParams
      .overCollateralRequirement;

    positionLPInfoArgs.capacityShares = new uint256[](positionsCache.length);
    positionLPInfoArgs.totalCapacity = _calculateMintShares(
      positionLPInfoArgs.price,
      positionLPInfoArgs.decimals,
      positionsCache,
      positionLPInfoArgs.capacityShares
    );

    ISynthereumMultiLpLiquidityPool.LPPosition memory lpPosition;
    for (uint256 j = 0; j < positionsCache.length; j++) {
      if (positionsCache[j].lp == _lp) {
        lpPosition = positionsCache[j].lpPosition;
        info.actualCollateralAmount = lpPosition.actualCollateralAmount;
        info.tokensCollateralized = lpPosition.tokensCollateralized;
        info.overCollateralization = lpPosition.overCollateralization;
        info.capacity = positionLPInfoArgs.capacityShares[j];
        positionLPInfoArgs.tokensValue = _calculateCollateralAmount(
          lpPosition.tokensCollateralized,
          positionLPInfoArgs.price,
          positionLPInfoArgs.decimals
        );
        info.utilization = lpPosition.actualCollateralAmount != 0
          ? (
            positionLPInfoArgs.tokensValue.mul(lpPosition.overCollateralization)
          ).div(lpPosition.actualCollateralAmount)
          : lpPosition.tokensCollateralized > 0
          ? PreciseUnitMath.PRECISE_UNIT
          : 0;
        (
          info.isOvercollateralized,
          positionLPInfoArgs.maxCapacity
        ) = _isOvercollateralizedLP(
          lpPosition.actualCollateralAmount,
          positionLPInfoArgs.overCollateralLimit,
          lpPosition.tokensCollateralized,
          positionLPInfoArgs.price,
          positionLPInfoArgs.decimals
        );
        info.coverage = lpPosition.tokensCollateralized != 0
          ? PreciseUnitMath.PRECISE_UNIT +
            (
              positionLPInfoArgs.overCollateralLimit.mul(
                positionLPInfoArgs.maxCapacity.div(
                  lpPosition.tokensCollateralized
                )
              )
            )
          : lpPosition.actualCollateralAmount == 0
          ? 0
          : PreciseUnitMath.maxUint256();
        info.mintShares = positionLPInfoArgs.totalCapacity != 0
          ? positionLPInfoArgs.capacityShares[j].div(
            positionLPInfoArgs.totalCapacity
          )
          : 0;
        info.redeemShares = positionLPInfoArgs.totalSynthTokens != 0
          ? lpPosition.tokensCollateralized.div(
            positionLPInfoArgs.totalSynthTokens
          )
          : 0;

        return info;
      }
    }
  }

  /**
   * @notice Update collateral amount of every LP
   * @param _storageParams Struct containing all storage variables of a pool (See Storage struct)
   * @param _positionsCache Temporary memory cache containing LPs positions
   */
  function _updateActualLPCollateral(
    ISynthereumMultiLpLiquidityPool.Storage storage _storageParams,
    PositionCache[] memory _positionsCache
  ) internal {
    PositionCache memory lpCache;
    for (uint256 j = 0; j < _positionsCache.length; j++) {
      lpCache = _positionsCache[j];
      _storageParams.lpPositions[lpCache.lp].actualCollateralAmount = lpCache
        .lpPosition
        .actualCollateralAmount;
    }
  }

  /**
   * @notice Update collateral amount of every LP and add the new deposit for one LP
   * @param _storageParams Struct containing all storage variables of a pool (See Storage struct)
   * @param _positionsCache Temporary memory cache containing LPs positions
   * @param _depositingLp Address of the LP depositing collateral
   * @param _increaseCollateral Amount of collateral to increase to the LP
   */
  function _updateAndIncreaseActualLPCollateral(
    ISynthereumMultiLpLiquidityPool.Storage storage _storageParams,
    PositionCache[] memory _positionsCache,
    address _depositingLp,
    uint256 _increaseCollateral
  ) internal {
    PositionCache memory lpCache;
    address lp;
    uint256 actualCollateralAmount;
    for (uint256 j = 0; j < _positionsCache.length; j++) {
      lpCache = _positionsCache[j];
      lp = lpCache.lp;
      actualCollateralAmount = lpCache.lpPosition.actualCollateralAmount;
      if (lp == _depositingLp) {
        _storageParams.lpPositions[lp].actualCollateralAmount =
          actualCollateralAmount +
          _increaseCollateral;
      } else {
        _storageParams
          .lpPositions[lp]
          .actualCollateralAmount = actualCollateralAmount;
      }
    }
  }

  /**
   * @notice Update collateral amount of every LP and removw withdrawal for one LP
   * @param _storageParams Struct containing all storage variables of a pool (See Storage struct)
   * @param _positionsCache Temporary memory cache containing LPs positions
   * @param _depositingLp Address of the LP withdrawing collateral
   * @param _decreaseCollateral Amount of collateral to decrease from the LP
   * @param _price Actual price of the pair
   * @param _collateralDecimals Decimals of the collateral token
   */
  function _updateAndDecreaseActualLPCollateral(
    ISynthereumMultiLpLiquidityPool.Storage storage _storageParams,
    PositionCache[] memory _positionsCache,
    address _depositingLp,
    uint256 _decreaseCollateral,
    uint256 _price,
    uint8 _collateralDecimals
  ) internal {
    PositionCache memory lpCache;
    address lp;
    ISynthereumMultiLpLiquidityPool.LPPosition memory lpPosition;
    uint256 actualCollateralAmount;
    uint256 newCollateralAmount;
    for (uint256 j = 0; j < _positionsCache.length; j++) {
      lpCache = _positionsCache[j];
      lp = lpCache.lp;
      lpPosition = lpCache.lpPosition;
      actualCollateralAmount = lpPosition.actualCollateralAmount;
      if (lp == _depositingLp) {
        newCollateralAmount = actualCollateralAmount - _decreaseCollateral;
        (bool isOvercollateralized, ) = _isOvercollateralizedLP(
          newCollateralAmount,
          lpPosition.overCollateralization,
          lpPosition.tokensCollateralized,
          _price,
          _collateralDecimals
        );
        require(
          isOvercollateralized,
          'LP below its overcollateralization level'
        );
        _storageParams
          .lpPositions[lp]
          .actualCollateralAmount = newCollateralAmount;
      } else {
        _storageParams
          .lpPositions[lp]
          .actualCollateralAmount = actualCollateralAmount;
      }
    }
  }

  /**
   * @notice Update collateral amount of every LP and change overcollateralization for one LP
   * @param _storageParams Struct containing all storage variables of a pool (See Storage struct)
   * @param _positionsCache Temporary memory cache containing LPs positions
   * @param _lp Address of the LP changing overcollateralization
   * @param _newOverCollateralization New overcollateralization to be set for the LP
   * @param _price Actual price of the pair
   * @param _collateralDecimals Decimals of the collateral token
   */
  function _updateAndModifyActualLPOverCollateral(
    ISynthereumMultiLpLiquidityPool.Storage storage _storageParams,
    PositionCache[] memory _positionsCache,
    address _lp,
    uint128 _newOverCollateralization,
    uint256 _price,
    uint8 _collateralDecimals
  ) internal {
    PositionCache memory lpCache;
    address lp;
    ISynthereumMultiLpLiquidityPool.LPPosition memory lpPosition;
    uint256 actualCollateralAmount;
    for (uint256 j = 0; j < _positionsCache.length; j++) {
      lpCache = _positionsCache[j];
      lp = lpCache.lp;
      lpPosition = lpCache.lpPosition;
      actualCollateralAmount = lpPosition.actualCollateralAmount;
      if (lp == _lp) {
        (bool isOvercollateralized, ) = _isOvercollateralizedLP(
          actualCollateralAmount,
          _newOverCollateralization,
          lpPosition.tokensCollateralized,
          _price,
          _collateralDecimals
        );
        require(
          isOvercollateralized,
          'LP below its overcollateralization level'
        );
        _storageParams
          .lpPositions[lp]
          .actualCollateralAmount = actualCollateralAmount;
        _storageParams
          .lpPositions[lp]
          .overCollateralization = _newOverCollateralization;
      } else {
        _storageParams
          .lpPositions[lp]
          .actualCollateralAmount = actualCollateralAmount;
      }
    }
  }

  /**
   * @notice Update collateral amount and synthetic assets of every LP
   * @param _storageParams Struct containing all storage variables of a pool (See Storage struct)
   * @param _positionsCache Temporary memory cache containing LPs positions
   */
  function _updateActualLPPositions(
    ISynthereumMultiLpLiquidityPool.Storage storage _storageParams,
    PositionCache[] memory _positionsCache
  ) internal {
    PositionCache memory lpCache;
    ISynthereumMultiLpLiquidityPool.LPPosition memory lpPosition;
    for (uint256 j = 0; j < _positionsCache.length; j++) {
      lpCache = _positionsCache[j];
      lpPosition = lpCache.lpPosition;
      _storageParams.lpPositions[lpCache.lp].actualCollateralAmount = lpPosition
        .actualCollateralAmount;
      _storageParams.lpPositions[lpCache.lp].tokensCollateralized = lpPosition
        .tokensCollateralized;
    }
  }

  /**
   * @notice Update collateral amount of every LP and add the new deposit for one LP
   * @param _storageParams Struct containing all storage variables of a pool (See Storage struct)
   * @param _positionsCache Temporary memory cache containing LPs positions
   * @param _liquidatedLp Address of the LP to liquidate
   * @param _tokensInLiquidation Amount of synthetic token to liquidate
   * @param _liquidationUpdateArgs Arguments for update liquidation (see LiquidationUpdateArgs struct)
   * @return tokensToLiquidate Amount of tokens will be liquidated
   * @return collateralAmount Amount of collateral value equivalent to tokens in liquidation
   * @return liquidationBonusAmount Amount of bonus collateral for the liquidation
   * @return collateralReceived Amount of collateral received by the liquidator
   */
  function _updateAndLiquidate(
    ISynthereumMultiLpLiquidityPool.Storage storage _storageParams,
    PositionCache[] memory _positionsCache,
    address _liquidatedLp,
    uint256 _tokensInLiquidation,
    LiquidationUpdateArgs memory _liquidationUpdateArgs
  )
    internal
    returns (
      uint256 tokensToLiquidate,
      uint256 collateralAmount,
      uint256 liquidationBonusAmount,
      uint256 collateralReceived
    )
  {
    for (uint256 j = 0; j < _positionsCache.length; j++) {
      _liquidationUpdateArgs.lpCache = _positionsCache[j];
      _liquidationUpdateArgs.lp = _liquidationUpdateArgs.lpCache.lp;
      // lpPosition = lpCache.lpPosition;
      _liquidationUpdateArgs.actualCollateralAmount = _liquidationUpdateArgs
        .lpCache
        .lpPosition
        .actualCollateralAmount;
      _liquidationUpdateArgs.actualSynthTokens = _liquidationUpdateArgs
        .lpCache
        .lpPosition
        .tokensCollateralized;

      if (_liquidationUpdateArgs.lp == _liquidatedLp) {
        tokensToLiquidate = PreciseUnitMath.min(
          _tokensInLiquidation,
          _liquidationUpdateArgs.actualSynthTokens
        );
        require(tokensToLiquidate > 0, 'No synthetic tokens to liquidate');

        collateralAmount = _calculateCollateralAmount(
          tokensToLiquidate,
          _liquidationUpdateArgs.tempStorageArgs.price,
          _liquidationUpdateArgs.tempStorageArgs.decimals
        );

        (bool isOvercollateralized, ) = _isOvercollateralizedLP(
          _liquidationUpdateArgs.actualCollateralAmount,
          _liquidationUpdateArgs.overCollateralRequirement,
          _liquidationUpdateArgs.actualSynthTokens,
          _liquidationUpdateArgs.tempStorageArgs.price,
          _liquidationUpdateArgs.tempStorageArgs.decimals
        );
        require(!isOvercollateralized, 'LP is overcollateralized');

        liquidationBonusAmount = _liquidationUpdateArgs
          .actualCollateralAmount
          .mul(_storageParams.liquidationBonus)
          .mul(tokensToLiquidate.div(_liquidationUpdateArgs.actualSynthTokens));

        (
          ILendingManager.ReturnValues memory lendingValues,
          WithdrawDust memory withdrawDust
        ) = _lendingWithdraw(
            _liquidationUpdateArgs.lendingManager,
            _liquidationUpdateArgs.liquidator,
            collateralAmount + liquidationBonusAmount
          );

        liquidationBonusAmount = withdrawDust.isPositive
          ? liquidationBonusAmount - withdrawDust.amount
          : liquidationBonusAmount + withdrawDust.amount;

        collateralReceived = lendingValues.tokensTransferred;

        _storageParams.lpPositions[_liquidatedLp].actualCollateralAmount =
          _liquidationUpdateArgs.actualCollateralAmount -
          liquidationBonusAmount;
        _storageParams.lpPositions[_liquidatedLp].tokensCollateralized =
          _liquidationUpdateArgs.actualSynthTokens -
          tokensToLiquidate;
      } else {
        _storageParams
          .lpPositions[_liquidationUpdateArgs.lp]
          .actualCollateralAmount = _liquidationUpdateArgs
          .actualCollateralAmount;
      }
    }
  }

  /**
   * @notice Set new liquidation reward percentage
   * @param _storageParams Struct containing all storage variables of a pool (See Storage struct)
   * @param _newLiquidationReward New liquidation reward percentage
   */
  function _setLiquidationReward(
    ISynthereumMultiLpLiquidityPool.Storage storage _storageParams,
    uint64 _newLiquidationReward
  ) internal {
    require(
      _newLiquidationReward > 0 &&
        _newLiquidationReward <= PreciseUnitMath.PRECISE_UNIT,
      'Liquidation reward must be between 0 and 100%'
    );
    _storageParams.liquidationBonus = _newLiquidationReward;
    emit SetLiquidationReward(_newLiquidationReward);
  }

  /**
   * @notice Set new fee percentage
   * @param _storageParams Struct containing all storage variables of a pool (See Storage struct)
   * @param _newFee New fee percentage
   */
  function _setFee(
    ISynthereumMultiLpLiquidityPool.Storage storage _storageParams,
    uint64 _newFee
  ) internal {
    require(
      _newFee < PreciseUnitMath.PRECISE_UNIT,
      'Fee Percentage must be less than 100%'
    );
    _storageParams.fee = _newFee;
    emit SetFeePercentage(_newFee);
  }

  /**
   * @notice Set new lending module name
   * @param _storageParams Struct containing all storage variables of a pool (See Storage struct)
   * @param _lendingModuleId Lending module name
   */
  function _setLendingModule(
    ISynthereumMultiLpLiquidityPool.Storage storage _storageParams,
    string calldata _lendingModuleId
  ) internal {
    _storageParams.lendingModuleId = _lendingModuleId;
    emit NewLendingModule(_lendingModuleId);
  }

  /**
   * @notice Deposit collateral to the lending manager
   * @param _lendingManager Addres of lendingManager
   * @param _sender User/LP depositing
   * @param _collateralAsset Collateral token of the pool
   * @param _collateralAmount Amount of collateral to deposit
   * @return Return values parameters from lending manager
   */
  function _lendingDeposit(
    ILendingManager _lendingManager,
    address _sender,
    IStandardERC20 _collateralAsset,
    uint256 _collateralAmount
  ) internal returns (ILendingManager.ReturnValues memory) {
    _collateralAsset.safeTransferFrom(
      _sender,
      address(_lendingManager),
      _collateralAmount
    );

    return _lendingManager.deposit(_collateralAmount);
  }

  /**
   * @notice Withdraw collateral from the lending manager
   * @param _lendingManager Addres of lendingManager
   * @param _recipient Recipient to which collateral is sent
   * @param _collateralAmount Collateral to withdraw
   * @return Return values parameters from lending manager
   * @return Dust to add/decrease if transfer of bearing token from pool to lending manager is not exact
   */
  function _lendingWithdraw(
    ILendingManager _lendingManager,
    address _recipient,
    uint256 _collateralAmount
  )
    internal
    returns (ILendingManager.ReturnValues memory, WithdrawDust memory)
  {
    (uint256 bearingAmount, address bearingToken) = _lendingManager
      .collateralToInterestToken(address(this), _collateralAmount);

    (uint256 amountTransferred, ) = IERC20(bearingToken).explicitSafeTransfer(
      address(_lendingManager),
      bearingAmount
    );

    ILendingManager.ReturnValues memory returnValues = _lendingManager.withdraw(
      amountTransferred,
      _recipient
    );

    bool isPositiveDust = _collateralAmount >= returnValues.tokensOut;

    return (
      returnValues,
      WithdrawDust(
        isPositiveDust,
        isPositiveDust
          ? _collateralAmount - returnValues.tokensOut
          : returnValues.tokensOut - _collateralAmount
      )
    );
  }

  /**
   * @notice Migrate lending module protocol
   * @param _lendingManager Addres of lendingManager
   * @param _lendingStorageManager Addres of lendingStoarageManager
   * @param  _lendingId Name of the new lending protocol to migrate to
   * @param  _bearingToken Bearing token of the new lending protocol to switch (only if requetsed by the protocol)
   * @return Return migration values parameters from lending manager
   */
  function _lendingMigration(
    ILendingManager _lendingManager,
    ILendingStorageManager _lendingStorageManager,
    string calldata _lendingId,
    address _bearingToken
  ) internal returns (ILendingManager.MigrateReturnValues memory) {
    IERC20 actualBearingToken = IERC20(
      _lendingStorageManager.getInterestBearingToken(address(this))
    );
    uint256 actualBearingAmount = actualBearingToken.balanceOf(address(this));
    (uint256 amountTransferred, ) = actualBearingToken.explicitSafeTransfer(
      address(_lendingManager),
      actualBearingAmount
    );
    return
      _lendingManager.migrateLendingModule(
        _lendingId,
        _bearingToken,
        amountTransferred
      );
  }

  /**
   * @notice Pulls and burns synthetic tokens from the sender
   * @param _syntheticAsset Synthetic asset of the pool
   * @param _numTokens The number of tokens to be burned
   * @param _sender Sender of synthetic tokens
   */
  function _burnSyntheticTokens(
    IMintableBurnableERC20 _syntheticAsset,
    uint256 _numTokens,
    address _sender
  ) internal {
    // Transfer synthetic token from the user to the pool
    _syntheticAsset.safeTransferFrom(_sender, address(this), _numTokens);

    // Burn synthetic asset
    _syntheticAsset.burn(_numTokens);
  }

  /**
   * @notice Calculate new positons from previous interaction
   * @param _storageParams Struct containing all storage variables of a pool (See Storage struct)
   * @param _totalInterests Amount of interests to split between active LPs
   * @param _price Actual price of the pair
   * @param _totalSynthTokens Amount of synthetic asset collateralized by the pool
   * @param _prevTotalCollateral Total amount in the pool before the operation
   * @param _collateralDecimals Decimals of the collateral token
   * @return positionsCache Temporary memory cache containing LPs positions
   * @return prevTotalLPsCollateral Sum of all the LP's collaterals before interests and P&L are charged
   */
  function _calculateNewPositions(
    ISynthereumMultiLpLiquidityPool.Storage storage _storageParams,
    uint256 _totalInterests,
    uint256 _price,
    uint256 _totalSynthTokens,
    uint256 _prevTotalCollateral,
    uint8 _collateralDecimals
  )
    internal
    view
    returns (
      PositionCache[] memory positionsCache,
      uint256 prevTotalLPsCollateral
    )
  {
    uint256 lpNumbers = _storageParams.activeLPs.length();
    if (lpNumbers > 0) {
      positionsCache = new PositionCache[](lpNumbers);

      prevTotalLPsCollateral = _calculateInterest(
        _storageParams,
        _totalInterests,
        _price,
        _collateralDecimals,
        positionsCache
      );

      _calculateProfitAndLoss(
        _price,
        _totalSynthTokens,
        _prevTotalCollateral - prevTotalLPsCollateral,
        _collateralDecimals,
        positionsCache
      );
    }
  }

  /**
   * @notice Calculate interests of each Lp
   * @param _storageParams Struct containing all storage variables of a pool (See Storage struct)
   * @param _totalInterests Amount of interests to split between active LPs
   * @param _price Actual price of the pair
   * @param _collateralDecimals Decimals of the collateral token
   * @param _positionsCache Temporary memory cache containing LPs positions
   * @return prevTotalLPsCollateral Sum of all the LP's collaterals before interests are charged
   */
  function _calculateInterest(
    ISynthereumMultiLpLiquidityPool.Storage storage _storageParams,
    uint256 _totalInterests,
    uint256 _price,
    uint8 _collateralDecimals,
    PositionCache[] memory _positionsCache
  ) internal view returns (uint256 prevTotalLPsCollateral) {
    uint256 lpNumbers = _positionsCache.length;
    TempInterstArgs memory tempInterstArguments;
    uint256[] memory capacityShares = new uint256[](_positionsCache.length);
    uint256[] memory utilizationShares = new uint256[](_positionsCache.length);

    (
      tempInterstArguments.totalCapacity,
      tempInterstArguments.totalUtilization,
      prevTotalLPsCollateral
    ) = _calculateInterestShares(
      _storageParams,
      _price,
      _collateralDecimals,
      _positionsCache,
      capacityShares,
      utilizationShares
    );

    tempInterstArguments.isTotCapacityNotZero =
      tempInterstArguments.totalCapacity > 0;
    tempInterstArguments.isTotUtilizationNotZero =
      tempInterstArguments.totalUtilization > 0;
    require(
      tempInterstArguments.isTotCapacityNotZero ||
        tempInterstArguments.isTotUtilizationNotZero,
      'No capacity and utilization'
    );
    ISynthereumMultiLpLiquidityPool.LPPosition memory lpPosition;
    tempInterstArguments.remainingInterest = _totalInterests;
    for (uint256 j = 0; j < lpNumbers - 1; j++) {
      tempInterstArguments.capacityShare = tempInterstArguments
        .isTotCapacityNotZero
        ? capacityShares[j].div(tempInterstArguments.totalCapacity)
        : 0;
      tempInterstArguments.utilizationShare = tempInterstArguments
        .isTotUtilizationNotZero
        ? utilizationShares[j].div(tempInterstArguments.totalUtilization)
        : 0;
      tempInterstArguments.interest = _totalInterests.mul(
        (tempInterstArguments.capacityShare +
          tempInterstArguments.utilizationShare) / 2
      );
      lpPosition = _positionsCache[j].lpPosition;
      lpPosition.actualCollateralAmount += tempInterstArguments.interest;
      tempInterstArguments.remainingInterest -= tempInterstArguments.interest;
    }

    lpPosition = _positionsCache[lpNumbers - 1].lpPosition;
    lpPosition.actualCollateralAmount += tempInterstArguments.remainingInterest;
  }

  /**
   * @notice Calculate interest shares of each LP
   * @param _storageParams Struct containing all storage variables of a pool (See Storage struct)
   * @param _price Actual price of the pair
   * @param _collateralDecimals Decimals of the collateral token
   * @param _positionsCache Temporary memory cache containing LPs positions
   * @param _capacityShares Array to be populated with the capacity shares of every LP
   * @param _utilizationShares Array to be populated with the utilization shares of every LP
   * @return totalCapacity Sum of all the LP's capacities
   * @return totalUtilization Sum of all the LP's utilizations
   * @return totalLPsCollateral Sum of all the LP's collaterals
   */
  function _calculateInterestShares(
    ISynthereumMultiLpLiquidityPool.Storage storage _storageParams,
    uint256 _price,
    uint8 _collateralDecimals,
    PositionCache[] memory _positionsCache,
    uint256[] memory _capacityShares,
    uint256[] memory _utilizationShares
  )
    internal
    view
    returns (
      uint256 totalCapacity,
      uint256 totalUtilization,
      uint256 totalLPsCollateral
    )
  {
    for (uint256 j = 0; j < _positionsCache.length; j++) {
      address lp = _storageParams.activeLPs.at(j);
      ISynthereumMultiLpLiquidityPool.LPPosition
        memory lpPosition = _storageParams.lpPositions[lp];
      uint256 capacityShare = _calculateCapacity(
        lpPosition,
        _price,
        _collateralDecimals
      );
      uint256 utilizationShare = _calculateUtilization(
        lpPosition,
        _price,
        _collateralDecimals
      );
      _capacityShares[j] = capacityShare;
      totalCapacity += capacityShare;
      _utilizationShares[j] = utilizationShare;
      totalUtilization += utilizationShare;
      _positionsCache[j] = PositionCache(
        lp,
        ISynthereumMultiLpLiquidityPool.LPPosition(
          lpPosition.actualCollateralAmount,
          lpPosition.tokensCollateralized,
          lpPosition.overCollateralization
        )
      );
      totalLPsCollateral += lpPosition.actualCollateralAmount;
    }
  }

  /**
   * @notice Calculate profit or loss of each Lp
   * @param _price Actual price of the pair
   * @param _totalSynthTokens Amount of synthetic asset collateralized by the pool
   * @param _totalUserAmount Actual amount deposited by the users
   * @param _positionsCache Temporary memory cache containing LPs positions
   * @param _collateralDecimals Decimals of the collateral token
   */
  function _calculateProfitAndLoss(
    uint256 _price,
    uint256 _totalSynthTokens,
    uint256 _totalUserAmount,
    uint8 _collateralDecimals,
    PositionCache[] memory _positionsCache
  ) internal pure {
    if (_totalSynthTokens == 0) {
      return;
    }

    uint256 lpNumbers = _positionsCache.length;

    uint256 totalAssetValue = _calculateCollateralAmount(
      _totalSynthTokens,
      _price,
      _collateralDecimals
    );

    bool isLpGain = totalAssetValue < _totalUserAmount;

    uint256 totalProfitOrLoss = isLpGain
      ? _totalUserAmount - totalAssetValue
      : totalAssetValue - _totalUserAmount;

    uint256 remainingProfitOrLoss = totalProfitOrLoss;
    ISynthereumMultiLpLiquidityPool.LPPosition memory lpPosition;
    uint256 assetRatio;
    uint256 lpProfitOrLoss;
    for (uint256 j = 0; j < lpNumbers - 1; j++) {
      lpPosition = _positionsCache[j].lpPosition;
      assetRatio = lpPosition.tokensCollateralized.div(_totalSynthTokens);
      lpProfitOrLoss = totalProfitOrLoss.mul(assetRatio);
      lpPosition.actualCollateralAmount = isLpGain
        ? lpPosition.actualCollateralAmount + lpProfitOrLoss
        : lpPosition.actualCollateralAmount - lpProfitOrLoss;
      remainingProfitOrLoss -= lpProfitOrLoss;
    }

    lpPosition = _positionsCache[lpNumbers - 1].lpPosition;
    lpPosition.actualCollateralAmount = isLpGain
      ? lpPosition.actualCollateralAmount + remainingProfitOrLoss
      : lpPosition.actualCollateralAmount - remainingProfitOrLoss;
  }

  /**
   * @notice Check if the input LP is registered
   * @param _storageParams Struct containing all storage variables of a pool (See Storage struct)
   * @param _lp Address of the LP
   * @return Return true if the LP is regitered, otherwise false
   */
  function _isRegisteredLP(
    ISynthereumMultiLpLiquidityPool.Storage storage _storageParams,
    address _lp
  ) internal view returns (bool) {
    return _storageParams.registeredLPs.contains(_lp);
  }

  /**
   * @notice Check if the input LP is active
   * @param _storageParams Struct containing all storage variables of a pool (See Storage struct)
   * @param _lp Address of the LP
   * @return Return true if the LP is active, otherwise false
   */
  function _isActiveLP(
    ISynthereumMultiLpLiquidityPool.Storage storage _storageParams,
    address _lp
  ) internal view returns (bool) {
    return _storageParams.activeLPs.contains(_lp);
  }

  /**
   * @notice Return the address of the lendingManager
   * @param _finder Synthereum finder
   * @return Address of the lendingManager
   */
  function _getLendingManager(ISynthereumFinder _finder)
    internal
    view
    returns (ILendingManager)
  {
    return
      ILendingManager(
        _finder.getImplementationAddress(SynthereumInterfaces.LendingManager)
      );
  }

  function _getLendingStorageManager(ISynthereumFinder _finder)
    internal
    view
    returns (ILendingStorageManager)
  {
    return
      ILendingStorageManager(
        _finder.getImplementationAddress(
          SynthereumInterfaces.LendingStorageManager
        )
      );
  }

  /**
   * @notice Calculate and returns interest generated by the pool from the last update
   * @param _lendingManager Address of lendingManager
   * @return poolInterests Return interest generated by the pool
   * @return collateralDeposited Collateral deposited in the pool (LPs + users) (excluding last intrest amount calculation)
   */
  function _getLendingInterest(ILendingManager _lendingManager)
    internal
    view
    returns (uint256 poolInterests, uint256 collateralDeposited)
  {
    (poolInterests, , , collateralDeposited) = _lendingManager
      .getAccumulatedInterest(address(this));
  }

  /**
   * @notice Return the on-chain oracle price for a pair
   * @param _finder Synthereum finder
   * @param _priceIdentifier Price identifier
   * @return Latest rate of the pair
   */
  function _getPriceFeedRate(
    ISynthereumFinder _finder,
    bytes32 _priceIdentifier
  ) internal view returns (uint256) {
    ISynthereumPriceFeed priceFeed = ISynthereumPriceFeed(
      _finder.getImplementationAddress(SynthereumInterfaces.PriceFeed)
    );

    return priceFeed.getLatestPrice(_priceIdentifier);
  }

  /**
   * @notice Given a collateral value to be exchanged, returns the fee amount, net collateral and synthetic tokens
   * @param _storageParams Struct containing all storage variables of a pool (See Storage struct)
   * @param _totCollateralAmount Collateral amount to be exchanged
   * @param _price Actual price of the pair
   * @param _collateralDecimals Decimals of the collateral token
   * @return Return netCollateralAmount, feeAmount and numTokens
   */
  function _calculateMint(
    ISynthereumMultiLpLiquidityPool.Storage storage _storageParams,
    uint256 _totCollateralAmount,
    uint256 _price,
    uint8 _collateralDecimals
  )
    internal
    view
    returns (ISynthereumMultiLpLiquidityPoolEvents.MintValues memory)
  {
    uint256 feeAmount = _totCollateralAmount.mul(_storageParams.fee);

    uint256 netCollateralAmount = _totCollateralAmount - feeAmount;

    uint256 numTokens = _calculateNumberOfTokens(
      netCollateralAmount,
      _price,
      _collateralDecimals
    );

    return
      ISynthereumMultiLpLiquidityPoolEvents.MintValues(
        _totCollateralAmount,
        netCollateralAmount,
        feeAmount,
        numTokens
      );
  }

  /**
   * @notice Given a an amount of synthetic tokens to be exchanged, returns the fee amount, net collateral and gross collateral
   * @param _storageParams Struct containing all storage variables of a pool (See Storage struct)
   * @param _numTokens Synthetic tokens amount to be exchanged
   * @param _price Actual price of the pair
   * @param _collateralDecimals Decimals of the collateral token
   * @return Return netCollateralAmount, feeAmount and totCollateralAmount
   */
  function _calculateRedeem(
    ISynthereumMultiLpLiquidityPool.Storage storage _storageParams,
    uint256 _numTokens,
    uint256 _price,
    uint8 _collateralDecimals
  )
    internal
    view
    returns (ISynthereumMultiLpLiquidityPoolEvents.RedeemValues memory)
  {
    uint256 totCollateralAmount = _calculateCollateralAmount(
      _numTokens,
      _price,
      _collateralDecimals
    );

    uint256 feeAmount = totCollateralAmount.mul(_storageParams.fee);

    uint256 netCollateralAmount = totCollateralAmount - feeAmount;

    return
      ISynthereumMultiLpLiquidityPoolEvents.RedeemValues(
        _numTokens,
        totCollateralAmount,
        feeAmount,
        netCollateralAmount
      );
  }

  /**
   * @notice Calculate fee and synthetic asset of each Lp in a mint transaction
   * @param _mintValues ExchangeAmount, feeAmount and numTokens
   * @param _price Actual price of the pair
   * @param _collateralDecimals Decimals of the collateral token
   * @param _positionsCache Temporary memory cache containing LPs positions
   */
  function _calculateMintTokensAndFee(
    ISynthereumMultiLpLiquidityPoolEvents.MintValues memory _mintValues,
    uint256 _price,
    uint8 _collateralDecimals,
    PositionCache[] memory _positionsCache
  ) internal pure {
    uint256 lpNumbers = _positionsCache.length;

    uint256[] memory capacityShares = new uint256[](lpNumbers);
    uint256 totalCapacity = _calculateMintShares(
      _price,
      _collateralDecimals,
      _positionsCache,
      capacityShares
    );

    require(
      totalCapacity >= _mintValues.numTokens,
      'No enough liquidity for covering mint operation'
    );

    SplitOperationArgs memory mintSplit;
    mintSplit.remainingTokens = _mintValues.numTokens;
    mintSplit.remainingFees = _mintValues.feeAmount;

    for (uint256 j = 0; j < lpNumbers; j++) {
      mintSplit.tokens = capacityShares[j].mul(
        _mintValues.numTokens.div(totalCapacity)
      );
      mintSplit.fees = _mintValues.feeAmount.mul(
        capacityShares[j].div(totalCapacity)
      );
      mintSplit.lpPosition = _positionsCache[j].lpPosition;
      mintSplit.bestShare = capacityShares[j] > mintSplit.bestShare.share
        ? BestShare(capacityShares[j], j)
        : mintSplit.bestShare;
      mintSplit.lpPosition.tokensCollateralized += mintSplit.tokens;
      mintSplit.lpPosition.actualCollateralAmount += mintSplit.fees;
      mintSplit.remainingTokens -= mintSplit.tokens;
      mintSplit.remainingFees = mintSplit.remainingFees - mintSplit.fees;
    }

    mintSplit.lpPosition = _positionsCache[mintSplit.bestShare.index]
      .lpPosition;
    mintSplit.lpPosition.tokensCollateralized += mintSplit.remainingTokens;
    mintSplit.lpPosition.actualCollateralAmount += mintSplit.remainingFees;
    (bool isOvercollateralized, ) = _isOvercollateralizedLP(
      mintSplit.lpPosition.actualCollateralAmount,
      mintSplit.lpPosition.overCollateralization,
      mintSplit.lpPosition.tokensCollateralized,
      _price,
      _collateralDecimals
    );
    require(
      isOvercollateralized,
      'No enough liquidity for covering split in mint operation'
    );
  }

  /**
   * @notice Calculate fee and synthetic asset of each Lp in a redeem transaction
   * @param _totalNumTokens Total amount of synethtic asset in the pool
   * @param _redeemNumTokens Total amount of synethtic asset to redeem
   * @param _feeAmount Total amount of fee to charge to the LPs
   * @param _withdrawDust Dust to add/decrease if transfer of bearing token from pool to lending manager is not exact
   * @param _positionsCache Temporary memory cache containing LPs positions
   */
  function _calculateRedeemTokensAndFee(
    uint256 _totalNumTokens,
    uint256 _redeemNumTokens,
    uint256 _feeAmount,
    WithdrawDust memory _withdrawDust,
    PositionCache[] memory _positionsCache
  ) internal pure {
    uint256 lpNumbers = _positionsCache.length;
    SplitOperationArgs memory redeemSplit;
    redeemSplit.remainingTokens = _redeemNumTokens;
    redeemSplit.remainingFees = _feeAmount;

    for (uint256 j = 0; j < lpNumbers; j++) {
      redeemSplit.lpPosition = _positionsCache[j].lpPosition;
      redeemSplit.tokens = redeemSplit.lpPosition.tokensCollateralized.mul(
        _redeemNumTokens.div(_totalNumTokens)
      );
      redeemSplit.fees = _feeAmount.mul(
        redeemSplit.lpPosition.tokensCollateralized.div(_totalNumTokens)
      );
      redeemSplit.bestShare = redeemSplit.lpPosition.tokensCollateralized >
        redeemSplit.bestShare.share
        ? BestShare(redeemSplit.lpPosition.tokensCollateralized, j)
        : redeemSplit.bestShare;
      redeemSplit.lpPosition.tokensCollateralized -= redeemSplit.tokens;
      redeemSplit.lpPosition.actualCollateralAmount += redeemSplit.fees;
      redeemSplit.remainingTokens -= redeemSplit.tokens;
      redeemSplit.remainingFees -= redeemSplit.fees;
    }
    redeemSplit.lpPosition = _positionsCache[redeemSplit.bestShare.index]
      .lpPosition;
    redeemSplit.lpPosition.tokensCollateralized -= redeemSplit.remainingTokens;
    redeemSplit.lpPosition.actualCollateralAmount = _withdrawDust.isPositive
      ? redeemSplit.lpPosition.actualCollateralAmount +
        redeemSplit.remainingFees +
        _withdrawDust.amount
      : redeemSplit.lpPosition.actualCollateralAmount +
        redeemSplit.remainingFees -
        _withdrawDust.amount;
  }

  /**
   * @notice Calculate the new collateral amount of the LPs after the switching of lending module
   * @param _prevLpsCollateral Total amount of collateral holded by the LPs before this operation
   * @param _migrationValues Values returned by the lending manager after the migration
   * @param _positionsCache Temporary memory cache containing LPs positions
   */
  function _calculateLendingModuleCollateral(
    uint256 _prevLpsCollateral,
    ILendingManager.MigrateReturnValues memory _migrationValues,
    PositionCache[] memory _positionsCache
  ) internal pure {
    uint256 prevTotalAmount = _migrationValues.prevTotalCollateral +
      _migrationValues.poolInterest;
    bool isLpGain = _migrationValues.actualTotalCollateral > prevTotalAmount;
    uint256 globalLpsProfitOrLoss = isLpGain
      ? _migrationValues.actualTotalCollateral - prevTotalAmount
      : prevTotalAmount - _migrationValues.actualTotalCollateral;
    if (globalLpsProfitOrLoss == 0) return;

    ISynthereumMultiLpLiquidityPool.LPPosition memory lpPosition;
    uint256 share;
    uint256 shareAmount;
    uint256 remainingAmount;
    uint256 lpNumbers = _positionsCache.length;
    for (uint256 j = 0; j < lpNumbers - 1; j++) {
      lpPosition = _positionsCache[j].lpPosition;
      share = lpPosition.actualCollateralAmount.div(_prevLpsCollateral);
      shareAmount = globalLpsProfitOrLoss.mul(share);
      lpPosition.actualCollateralAmount = isLpGain
        ? lpPosition.actualCollateralAmount + shareAmount
        : lpPosition.actualCollateralAmount - shareAmount;
      remainingAmount -= shareAmount;
    }

    lpPosition = _positionsCache[lpNumbers - 1].lpPosition;
    lpPosition.actualCollateralAmount = isLpGain
      ? lpPosition.actualCollateralAmount + remainingAmount
      : lpPosition.actualCollateralAmount - remainingAmount;
  }

  /**
   * @notice Calculate capacity in tokens of each LP
   * @dev Utilization = (actualCollateralAmount / overCollateralization) * price - tokensCollateralized
   * @dev Return 0 if underCollateralized
   * @param _lpPosition Actual LP position
   * @param _price Actual price of the pair
   * @param _collateralDecimals Decimals of the collateral token
   * @return Capacity of the LP
   */
  function _calculateCapacity(
    ISynthereumMultiLpLiquidityPool.LPPosition memory _lpPosition,
    uint256 _price,
    uint8 _collateralDecimals
  ) internal pure returns (uint256) {
    uint256 maxCapacity = _calculateNumberOfTokens(
      _lpPosition.actualCollateralAmount.div(_lpPosition.overCollateralization),
      _price,
      _collateralDecimals
    );
    return
      maxCapacity > _lpPosition.tokensCollateralized
        ? maxCapacity - _lpPosition.tokensCollateralized
        : 0;
  }

  /**
   * @notice Calculate utilization of an LP
   * @dev Utilization = (tokensCollateralized * price * overCollateralization) / actualCollateralAmount
   * @dev Capped to 1 in case of underCollateralization
   * @param _lpPosition Actual LP position
   * @param _price Actual price of the pair
   * @param _collateralDecimals Decimals of the collateral token
   * @return Utilization of the LP
   */
  function _calculateUtilization(
    ISynthereumMultiLpLiquidityPool.LPPosition memory _lpPosition,
    uint256 _price,
    uint8 _collateralDecimals
  ) internal pure returns (uint256) {
    return
      _lpPosition.actualCollateralAmount != 0
        ? PreciseUnitMath.min(
          _calculateCollateralAmount(
            _lpPosition.tokensCollateralized,
            _price,
            _collateralDecimals
          ).mul(_lpPosition.overCollateralization).div(
              _lpPosition.actualCollateralAmount
            ),
          PreciseUnitMath.PRECISE_UNIT
        )
        : _lpPosition.tokensCollateralized > 0
        ? PreciseUnitMath.PRECISE_UNIT
        : 0;
  }

  /**
   * @notice Calculate mint shares based on capacity
   * @param _price Actual price of the pair
   * @param _collateralDecimals Decimals of the collateral token
   * @param _positionsCache Temporary memory cache containing LPs positions
   * @param _capacityShares Array to be populated with the capacity shares of every LPP
   * @return totalCapacity Sum of all the LP's capacities
   */
  function _calculateMintShares(
    uint256 _price,
    uint8 _collateralDecimals,
    PositionCache[] memory _positionsCache,
    uint256[] memory _capacityShares
  ) internal pure returns (uint256 totalCapacity) {
    ISynthereumMultiLpLiquidityPool.LPPosition memory lpPosition;
    uint256 capacityShare;
    for (uint256 j = 0; j < _positionsCache.length; j++) {
      lpPosition = _positionsCache[j].lpPosition;
      capacityShare = _calculateCapacity(
        lpPosition,
        _price,
        _collateralDecimals
      );
      _capacityShares[j] = capacityShare;
      totalCapacity += capacityShare;
    }
  }

  /**
   * @notice Calculate synthetic token amount starting from an amount of collateral
   * @param _collateralAmount Amount of collateral from which you want to calculate synthetic token amount
   * @param _price Actual price of the pair
   * @param _collateralDecimals Decimals of the collateral token
   * @return Amount of tokens after on-chain oracle conversion
   */
  function _calculateNumberOfTokens(
    uint256 _collateralAmount,
    uint256 _price,
    uint8 _collateralDecimals
  ) internal pure returns (uint256) {
    return (_collateralAmount * (10**(18 - _collateralDecimals))).div(_price);
  }

  /**
   * @notice Calculate collateral amount starting from an amount of synthtic token
   * @param _numTokens Amount of synthetic tokens used for the conversion
   * @param _price Actual price of the pair
   * @param _collateralDecimals Decimals of the collateral token
   * @return Amount of collateral after on-chain oracle conversion
   */
  function _calculateCollateralAmount(
    uint256 _numTokens,
    uint256 _price,
    uint8 _collateralDecimals
  ) internal pure returns (uint256) {
    return _numTokens.mul(_price) / (10**(18 - _collateralDecimals));
  }

  /**
   * @notice Return if an LP is overcollateralized and the max capacity of the LP
   * @param _actualCollateralAmount Actual collateral amount holded by the LP
   * @param _overCollateralization Overcollateralization requested
   * @param _tokens Tokens collateralized
   * @param _price Actual price of the pair
   * @param _collateralDecimals Decimals of the collateral token
   * @return isOvercollateralized True if LP is overcollateralized otherwise false
   * @return maxCapacity Max capcity in synth tokens of the LP
   */
  function _isOvercollateralizedLP(
    uint256 _actualCollateralAmount,
    uint256 _overCollateralization,
    uint256 _tokens,
    uint256 _price,
    uint8 _collateralDecimals
  ) internal pure returns (bool isOvercollateralized, uint256 maxCapacity) {
    maxCapacity = _calculateNumberOfTokens(
      _actualCollateralAmount.div(_overCollateralization),
      _price,
      _collateralDecimals
    );
    isOvercollateralized = maxCapacity >= _tokens;
  }
}
