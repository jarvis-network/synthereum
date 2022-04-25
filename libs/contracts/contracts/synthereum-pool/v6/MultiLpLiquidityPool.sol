// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity 0.8.9;

import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {
  ISynthereumMultiLpLiquidityPool
} from './interfaces/IMultiLpLiquidityPool.sol';
import {
  ISynthereumMultiLpLiquidityPoolEvents
} from './interfaces/IMultiLpLiquidityPoolEvents.sol';
import {IStandardERC20} from '../../base/interfaces/IStandardERC20.sol';
import {
  IMintableBurnableERC20
} from '../../tokens/interfaces/IMintableBurnableERC20.sol';
import {ISynthereumFinder} from '../../core/interfaces/IFinder.sol';
import {
  ISynthereumPriceFeed
} from '../../oracle/common/interfaces/IPriceFeed.sol';
import {
  ILendingManager
} from '../../lending-module/interfaces/ILendingManager.sol';
import {
  ILendingStorageManager
} from '../../lending-module/interfaces/ILendingStorageManager.sol';
import {SynthereumInterfaces} from '../../core/Constants.sol';
import {
  SafeERC20
} from '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import {ExplicitERC20} from '../../base/utils/ExplicitERC20.sol';
import {
  EnumerableSet
} from '@openzeppelin/contracts/utils/structs/EnumerableSet.sol';
import {PreciseUnitMath} from '../../base/utils/PreciseUnitMath.sol';
import {ERC2771Context} from '../../common/ERC2771Context.sol';
import {
  ReentrancyGuard
} from '@openzeppelin/contracts/security/ReentrancyGuard.sol';
import {
  AccessControlEnumerable,
  Context
} from '@openzeppelin/contracts/access/AccessControlEnumerable.sol';

/**
 * @title Multi LP Synthereum pool
 */
contract SynthereumMultiLpLiquidityPool is
  ISynthereumMultiLpLiquidityPoolEvents,
  ISynthereumMultiLpLiquidityPool,
  ERC2771Context,
  ReentrancyGuard,
  AccessControlEnumerable
{
  using EnumerableSet for EnumerableSet.AddressSet;
  using PreciseUnitMath for uint256;
  using SafeERC20 for IStandardERC20;
  using SafeERC20 for IMintableBurnableERC20;
  using SafeERC20 for IERC20;
  using ExplicitERC20 for IERC20;

  struct PositionCache {
    // Address of the LP
    address lp;
    // Position of the LP
    LPPosition lpPosition;
  }

  struct TempStorageArgs {
    // Actual price
    uint256 price;
    // Total synthetic tokens of the pool
    uint256 totalSyntheticAsset;
    // Decimals of collateral
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
    LPPosition lpPosition;
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

  struct WithdrawDust {
    bool isPositive;
    uint256 amount;
  }

  struct LiquidationUpdateArgs {
    address liquidator;
    ILendingManager lendingManager;
    address liquidatedLp;
    uint256 tokensInLiquidation;
    uint256 overCollateralRequirement;
    TempStorageArgs tempStorageArgs;
  }

  //----------------------------------------
  // Constants
  //----------------------------------------

  string public constant override typology = 'POOL';

  bytes32 public constant MAINTAINER_ROLE = keccak256('Maintainer');

  //----------------------------------------
  // Storage
  //----------------------------------------

  EnumerableSet.AddressSet internal registeredLPs;

  EnumerableSet.AddressSet internal activeLPs;

  mapping(address => LPPosition) internal lpPositions;

  uint256 internal totalSyntheticAsset;

  uint256 internal fee;

  uint256 internal liquidationBonus;

  uint256 internal overCollateralRequirement;

  bytes32 internal priceIdentifier;

  string internal lendingModuleId;

  ISynthereumFinder internal finder;

  IMintableBurnableERC20 internal syntheticAsset;

  IStandardERC20 internal collateralAsset;

  uint8 internal collateralDecimals;

  uint8 internal poolVersion;

  bool internal isInitialized;

  //----------------------------------------
  // Modifiers
  //----------------------------------------

  modifier onlyMaintainer() {
    require(
      hasRole(MAINTAINER_ROLE, msg.sender),
      'Sender must be the maintainer'
    );
    _;
  }

  modifier isNotExpired(uint256 expirationTime) {
    require(block.timestamp <= expirationTime, 'Transaction expired');
    _;
  }

  /**
   * @notice Initialize pool
   * @param _params Params used for initialization (see InitializationParams struct)
   */
  function initialize(InitializationParams calldata _params)
    external
    override
    nonReentrant
  {
    require(!isInitialized, 'Pool already initialized');
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

    ISynthereumPriceFeed priceFeed =
      ISynthereumPriceFeed(
        _params.finder.getImplementationAddress(SynthereumInterfaces.PriceFeed)
      );
    require(
      priceFeed.isPriceSupported(_params.priceIdentifier),
      'Price identifier not supported'
    );

    finder = _params.finder;
    poolVersion = _params.version;
    collateralAsset = _params.collateralToken;
    collateralDecimals = collTokenDecimals;
    syntheticAsset = _params.syntheticToken;
    priceIdentifier = _params.priceIdentifier;
    overCollateralRequirement = _params.overCollateralRequirement;

    _setLiquidationReward(_params.liquidationReward);
    _setFee(_params.fee);
    _setLendingModule(_params.lendingModuleId);

    _setRoleAdmin(DEFAULT_ADMIN_ROLE, DEFAULT_ADMIN_ROLE);
    _setRoleAdmin(MAINTAINER_ROLE, DEFAULT_ADMIN_ROLE);
    _setupRole(DEFAULT_ADMIN_ROLE, _params.roles.admin);
    _setupRole(MAINTAINER_ROLE, _params.roles.maintainer);

    isInitialized = true;
  }

  /**
   * @notice Register a liquidity provider to the LP's whitelist
   * @notice This can be called only by the maintainer
   * @param _lp Address of the LP
   */
  function registerLP(address _lp)
    external
    override
    nonReentrant
    onlyMaintainer
  {
    require(registeredLPs.add(_lp), 'LP already registered');
    emit RegisteredLp(_lp);
  }

  /**
   * @notice Add the Lp to the active list of the LPs and initialize collateral and overcollateralization
   * @notice Only a registered and inactive LP can call this function to add himself
   * @param _collateralAmount Collateral amount to deposit by the LP
   * @param _overCollateralization Overcollateralization to set by the LP
   * @return collateralDeposited Net collateral deposited in the LP position
   */
  function activateLP(uint256 _collateralAmount, uint256 _overCollateralization)
    external
    override
    nonReentrant
    returns (uint256 collateralDeposited)
  {
    address msgSender = _msgSender();

    require(isRegisteredLP(msgSender), 'Sender must be a registered LP');
    require(_collateralAmount > 0, 'No collateral deposited');
    require(
      _overCollateralization > overCollateralRequirement,
      'Overcollateralization must be bigger than overcollateral requirement'
    );

    ISynthereumFinder synthFinder = finder;
    ILendingManager.ReturnValues memory lendingValues =
      _lendingDeposit(
        _getLendingManager(synthFinder),
        msgSender,
        collateralAsset,
        _collateralAmount
      );

    (PositionCache[] memory positionsCache, ) =
      _calculateNewPositions(
        lendingValues.poolInterest,
        _getPriceFeedRate(synthFinder, priceIdentifier),
        totalSyntheticAsset,
        lendingValues.prevTotalCollateral,
        collateralDecimals
      );

    _updateActualLPCollateral(positionsCache);

    collateralDeposited = lendingValues.tokensOut;
    lpPositions[msgSender] = LPPosition(
      collateralDeposited,
      0,
      _overCollateralization
    );

    require(activeLPs.add(msgSender), 'LP already active');

    emit ActivatedLP(msgSender);
    emit DepositedLiquidity(msgSender, _collateralAmount, collateralDeposited);
    emit SetOvercollateralization(msgSender, _overCollateralization);
  }

  /**
   * @notice Add collateral to an active LP position
   * @notice Only an active LP can call this function to add collateral to his position
   * @param _collateralAmount Collateral amount to deposit by the LP
   * @return collateralDeposited Net collateral deposited in the LP position
   */
  function addLiquidity(uint256 _collateralAmount)
    external
    override
    nonReentrant
    returns (uint256 collateralDeposited)
  {
    address msgSender = _msgSender();

    require(isActiveLP(msgSender), 'Sender must be an active LP');
    require(_collateralAmount > 0, 'No collateral added');

    ISynthereumFinder synthFinder = finder;
    ILendingManager.ReturnValues memory lendingValues =
      _lendingDeposit(
        _getLendingManager(synthFinder),
        msgSender,
        collateralAsset,
        _collateralAmount
      );

    TempStorageArgs memory tempStorage =
      TempStorageArgs(
        _getPriceFeedRate(synthFinder, priceIdentifier),
        totalSyntheticAsset,
        collateralDecimals
      );

    (PositionCache[] memory positionsCache, ) =
      _calculateNewPositions(
        lendingValues.poolInterest,
        tempStorage.price,
        tempStorage.totalSyntheticAsset,
        lendingValues.prevTotalCollateral,
        tempStorage.decimals
      );

    collateralDeposited = lendingValues.tokensOut;
    _updateAndIncreaseActualLPCollateral(
      positionsCache,
      msgSender,
      collateralDeposited
    );

    emit DepositedLiquidity(msgSender, _collateralAmount, collateralDeposited);
  }

  /**
   * @notice Withdraw collateral from an active LP position
   * @notice Only an active LP can call this function to withdraw collateral from his position
   * @param _collateralAmount Collateral amount to withdraw by the LP
   * @return collateralReceived Collateral received from the withdrawal
   */
  function removeLiquidity(uint256 _collateralAmount)
    external
    override
    nonReentrant
    returns (uint256 collateralReceived)
  {
    address msgSender = _msgSender();

    require(isActiveLP(msgSender), 'Sender must be an active LP');
    require(_collateralAmount > 0, 'No collateral withdrawn');

    ISynthereumFinder synthFinder = finder;
    (ILendingManager.ReturnValues memory lendingValues, ) =
      _lendingWithdraw(
        _getLendingManager(synthFinder),
        msgSender,
        _collateralAmount
      );

    TempStorageArgs memory tempStorage =
      TempStorageArgs(
        _getPriceFeedRate(synthFinder, priceIdentifier),
        totalSyntheticAsset,
        collateralDecimals
      );

    (PositionCache[] memory positionsCache, ) =
      _calculateNewPositions(
        lendingValues.poolInterest,
        tempStorage.price,
        tempStorage.totalSyntheticAsset,
        lendingValues.prevTotalCollateral,
        tempStorage.decimals
      );

    _updateAndDecreaseActualLPCollateral(
      positionsCache,
      msgSender,
      lendingValues.tokensOut,
      tempStorage.price,
      tempStorage.decimals
    );
    collateralReceived = lendingValues.tokensTransferred;

    emit WithdrawnLiquidity(
      msgSender,
      lendingValues.tokensOut,
      collateralReceived
    );
  }

  /**
   * @notice Set the overCollateralization by an active LP
   * @notice This can be called only by an active LP
   * @param _overCollateralization New overCollateralizations
   */
  function setOvercollateralization(uint256 _overCollateralization)
    external
    override
    nonReentrant
  {
    address msgSender = _msgSender();

    require(isActiveLP(msgSender), 'Sender must be an active LP');

    require(
      _overCollateralization > overCollateralRequirement,
      'Overcollateralization must be bigger than overcollateral requirement'
    );

    ISynthereumFinder synthFinder = finder;
    ILendingManager.ReturnValues memory lendingValues =
      _getLendingManager(synthFinder).updateAccumulatedInterest();

    TempStorageArgs memory tempStorage =
      TempStorageArgs(
        _getPriceFeedRate(synthFinder, priceIdentifier),
        totalSyntheticAsset,
        collateralDecimals
      );

    (PositionCache[] memory positionsCache, ) =
      _calculateNewPositions(
        lendingValues.poolInterest,
        tempStorage.price,
        tempStorage.totalSyntheticAsset,
        lendingValues.prevTotalCollateral,
        tempStorage.decimals
      );

    _updateAndModifyActualLPOverCollateral(
      positionsCache,
      msgSender,
      _overCollateralization,
      tempStorage.price,
      tempStorage.decimals
    );

    emit SetOvercollateralization(msgSender, _overCollateralization);
  }

  /**
   * @notice Mint synthetic tokens using fixed amount of collateral
   * @notice This calculate the price using on chain price feed
   * @notice User must approve collateral transfer for the mint request to succeed
   * @param _mintParams Input parameters for minting (see MintParams struct)
   * @return Amount of synthetic tokens minted by a user
   * @return Amount of collateral paid by the user as fee
   */
  function mint(MintParams calldata _mintParams)
    external
    override
    nonReentrant
    isNotExpired(_mintParams.expiration)
    returns (uint256, uint256)
  {
    address msgSender = _msgSender();

    require(_mintParams.collateralAmount > 0, 'No collateral sent');

    ISynthereumFinder synthFinder = finder;
    ILendingManager.ReturnValues memory lendingValues =
      _lendingDeposit(
        _getLendingManager(synthFinder),
        msgSender,
        collateralAsset,
        _mintParams.collateralAmount
      );

    TempStorageArgs memory tempStorage =
      TempStorageArgs(
        _getPriceFeedRate(synthFinder, priceIdentifier),
        totalSyntheticAsset,
        collateralDecimals
      );

    (PositionCache[] memory positionsCache, ) =
      _calculateNewPositions(
        lendingValues.poolInterest,
        tempStorage.price,
        tempStorage.totalSyntheticAsset,
        lendingValues.prevTotalCollateral,
        tempStorage.decimals
      );

    MintValues memory mintValues =
      _calculateMint(
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

    _updateActualLPPositions(positionsCache);

    totalSyntheticAsset =
      tempStorage.totalSyntheticAsset +
      mintValues.numTokens;

    syntheticAsset.mint(_mintParams.recipient, mintValues.numTokens);

    mintValues.totalCollateral = _mintParams.collateralAmount;

    emit Minted(msgSender, mintValues, _mintParams.recipient);

    return (mintValues.numTokens, mintValues.feeAmount);
  }

  /**
   * @notice Redeem amount of collateral using fixed number of synthetic token
   * @notice This calculate the price using on chain price feed
   * @notice User must approve synthetic token transfer for the redeem request to succeed
   * @param _redeemParams Input parameters for redeeming (see RedeemParams struct)
   * @return Amount of collateral redeemed by user
   * @return Amount of collateral paid by user as fee
   */
  function redeem(RedeemParams calldata _redeemParams)
    external
    override
    nonReentrant
    isNotExpired(_redeemParams.expiration)
    returns (uint256, uint256)
  {
    address msgSender = _msgSender();

    require(_redeemParams.numTokens > 0, 'No tokens sent');

    ISynthereumFinder synthFinder = finder;

    TempStorageArgs memory tempStorage =
      TempStorageArgs(
        _getPriceFeedRate(synthFinder, priceIdentifier),
        totalSyntheticAsset,
        collateralDecimals
      );

    RedeemValues memory redeemValues =
      _calculateRedeem(
        _redeemParams.numTokens,
        tempStorage.price,
        tempStorage.decimals
      );

    (
      ILendingManager.ReturnValues memory lendingValues,
      WithdrawDust memory withdrawDust
    ) =
      _lendingWithdraw(
        _getLendingManager(synthFinder),
        _redeemParams.recipient,
        redeemValues.collateralAmount
      );

    (PositionCache[] memory positionsCache, ) =
      _calculateNewPositions(
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

    _updateActualLPPositions(positionsCache);

    totalSyntheticAsset =
      tempStorage.totalSyntheticAsset -
      _redeemParams.numTokens;

    _burnSyntheticTokens(syntheticAsset, _redeemParams.numTokens, msgSender);

    redeemValues.collateralAmount = lendingValues.tokensTransferred;

    emit Redeemed(msgSender, redeemValues, _redeemParams.recipient);

    return (redeemValues.collateralAmount, redeemValues.feeAmount);
  }

  /**
   * @notice Liquidate Lp position for an amount of synthetic tokens undercollateralized
   * @notice Revert if position is not undercollateralized
   * @param _lp LP that the the user wants to liquidate
   * @param _numSynthTokens Number of synthetic tokens that user wants to liquidate
   * @return Amount of collateral received (Amount of collateral + bonus)
   */
  function liquidate(address _lp, uint256 _numSynthTokens)
    external
    override
    nonReentrant
    returns (uint256)
  {
    LiquidationUpdateArgs memory liquidationUpdateArgs;

    liquidationUpdateArgs.liquidator = _msgSender();

    require(isActiveLP(_lp), 'LP is not active');

    ISynthereumFinder synthFinder = finder;

    liquidationUpdateArgs.tempStorageArgs = TempStorageArgs(
      _getPriceFeedRate(synthFinder, priceIdentifier),
      totalSyntheticAsset,
      collateralDecimals
    );

    liquidationUpdateArgs.lendingManager = _getLendingManager(synthFinder);
    liquidationUpdateArgs.overCollateralRequirement = overCollateralRequirement;

    (uint256 poolInterest, uint256 collateralDeposited) =
      _getLendingInterest(liquidationUpdateArgs.lendingManager);

    (PositionCache[] memory positionsCache, ) =
      _calculateNewPositions(
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
    ) =
      _updateAndLiquidate(
        positionsCache,
        _lp,
        _numSynthTokens,
        liquidationUpdateArgs
      );

    totalSyntheticAsset =
      liquidationUpdateArgs.tempStorageArgs.totalSyntheticAsset -
      tokensInLiquidation;

    _burnSyntheticTokens(
      syntheticAsset,
      tokensInLiquidation,
      liquidationUpdateArgs.liquidator
    );

    emit Liquidated(
      liquidationUpdateArgs.liquidator,
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
   */
  function updatePositions() external override nonReentrant {
    ISynthereumFinder synthFinder = finder;
    ILendingManager.ReturnValues memory lendingValues =
      _getLendingManager(synthFinder).updateAccumulatedInterest();

    TempStorageArgs memory tempStorage =
      TempStorageArgs(
        _getPriceFeedRate(synthFinder, priceIdentifier),
        totalSyntheticAsset,
        collateralDecimals
      );

    (PositionCache[] memory positionsCache, ) =
      _calculateNewPositions(
        lendingValues.poolInterest,
        tempStorage.price,
        tempStorage.totalSyntheticAsset,
        lendingValues.prevTotalCollateral,
        tempStorage.decimals
      );

    _updateActualLPPositions(positionsCache);
  }

  /**
   * @notice Transfer a bearing amount to the lending manager
   * @notice Only the lending manager can call the function
   * @param _bearingAmount Amount of bearing token to transfer
   */
  function transferToLendingManager(uint256 _bearingAmount) external override {
    ILendingManager lendingManager = _getLendingManager(finder);
    require(
      msg.sender == address(lendingManager),
      'Sender must be lending manager'
    );

    (uint256 poolInterest, uint256 totalActualCollateral) =
      _getLendingInterest(lendingManager);

    (uint256 poolBearingValue, address bearingToken) =
      lendingManager.collateralToInterestToken(
        address(this),
        totalActualCollateral + poolInterest
      );

    IERC20 bearingCurrency = IERC20(bearingToken);
    bearingCurrency.safeTransfer(msg.sender, _bearingAmount);

    uint256 remainingBearingValue = bearingCurrency.balanceOf(address(this));
    require(remainingBearingValue >= poolBearingValue, 'Unfunded pool');
  }

  /**
   * @notice Set new liquidation reward percentage
   * @notice This can be called only by the maintainer
   * @param _newLiquidationReward New liquidation reward percentage
   */
  function setLiquidationReward(uint256 _newLiquidationReward)
    external
    override
    nonReentrant
    onlyMaintainer
  {
    _setLiquidationReward(_newLiquidationReward);
  }

  /**
   * @notice Set new fee percentage
   * @notice This can be called only by the maintainer
   * @param _newFee New fee percentage
   */
  function setFee(uint256 _newFee)
    external
    override
    nonReentrant
    onlyMaintainer
  {
    _setFee(_newFee);
  }

  /**
   * @notice Set new lending protocol for this pool
   * @notice This can be called only by the maintainer
   * @param _lendingId Name of the new lending module
   * @param _bearingToken Token of the lending mosule to be used for intersts accrual
            (used only if the lending manager doesn't automatically find the one associated to the collateral fo this pool)
   */
  /* function switchLendingModule(
    string calldata _lendingId,
    address _bearingToken
  ) external nonReentrant onlyMaintainer {
    ISynthereumFinder synthFinder = finder;
    ILendingManager.MigrateReturnValues memory migrationValues =
      _lendingMigration(
        _getLendingManager(synthFinder),
        _getLendingStorageManager(synthFinder),
        _lendingId,
        _bearingToken
      );

    TempStorageArgs memory tempStorage =
      TempStorageArgs(
        _getPriceFeedRate(synthFinder, priceIdentifier),
        totalSyntheticAsset,
        collateralDecimals
      );

    (PositionCache[] memory positionsCache, uint256 prevTotalLpsCollateral) =
      _calculateNewPositions(
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

    _updateActualLPPositions(positionsCache);

    _setLendingModule(_lendingId);
  }*/

  /**
   * @notice Get all the registered LPs of this pool
   * @return The list of addresses of all the registered LPs in the pool.
   */
  function getRegisteredLPs()
    external
    view
    override
    returns (address[] memory)
  {
    uint256 numberOfLPs = registeredLPs.length();
    address[] memory lpList = new address[](numberOfLPs);
    for (uint256 j = 0; j < numberOfLPs; j++) {
      lpList[j] = registeredLPs.at(j);
    }
    return lpList;
  }

  /**
   * @notice Get all the active LPs of this pool
   * @return The list of addresses of all the active LPs in the pool.
   */
  function getActiveLPs() external view override returns (address[] memory) {
    uint256 numberOfLPs = activeLPs.length();
    address[] memory lpList = new address[](numberOfLPs);
    for (uint256 j = 0; j < numberOfLPs; j++) {
      lpList[j] = activeLPs.at(j);
    }
    return lpList;
  }

  /**
   * @notice Returns total number of synthetic tokens generated by this pool
   * @return Number of synthetic tokens
   */
  function totalSyntheticTokens() external view override returns (uint256) {
    return totalSyntheticAsset;
  }

  /**
   * @notice Returns the total amounts of collateral
   * @return usersCollateral Total collateral amount currently holded by users
   * @return lpsCollateral Total collateral amount currently holded by LPs
   * @return totalCollateral Total collateral amount currently holded by users + LPs
   */
  function totalCollateralAmount()
    external
    view
    override
    returns (
      uint256 usersCollateral,
      uint256 lpsCollateral,
      uint256 totalCollateral
    )
  {
    ISynthereumFinder synthFinder = finder;
    usersCollateral = _calculateCollateralAmount(
      totalSyntheticAsset,
      _getPriceFeedRate(synthFinder, priceIdentifier),
      collateralDecimals
    );

    (uint256 poolInterest, uint256 totalActualCollateral) =
      _getLendingInterest(_getLendingManager(synthFinder));

    totalCollateral = totalActualCollateral + poolInterest;

    lpsCollateral = totalCollateral - usersCollateral;
  }

  /**
   * @notice Returns the max capacity in synth assets of all the LPs
   * @return maxCapacity Total max capacity of the pool
   */
  function maxTokensCapacity()
    external
    view
    override
    returns (uint256 maxCapacity)
  {
    ISynthereumFinder synthFinder = finder;
    uint256 price = _getPriceFeedRate(synthFinder, priceIdentifier);

    (uint256 poolInterest, uint256 collateralDeposited) =
      _getLendingInterest(_getLendingManager(synthFinder));

    uint8 decimals = collateralDecimals;
    (PositionCache[] memory positionsCache, ) =
      _calculateNewPositions(
        poolInterest,
        price,
        totalSyntheticAsset,
        collateralDeposited,
        decimals
      );

    LPPosition memory lpPosition;
    for (uint256 j = 0; j < positionsCache.length; j++) {
      lpPosition = positionsCache[j].lpPosition;
      uint256 lpCapacity = _calculateCapacity(lpPosition, price, decimals);
      maxCapacity += lpCapacity;
    }
  }

  /**
   * @notice Returns the LP parametrs info
   * @return info Info of the input lp (see LPInfo struct)
   */
  function positionLPInfo(address _lp)
    external
    view
    override
    returns (LPInfo memory info)
  {
    require(isActiveLP(_lp), 'LP not active');

    ISynthereumFinder synthFinder = finder;
    PositionLPInfoArgs memory positionLPInfoArgs;
    positionLPInfoArgs.price = _getPriceFeedRate(synthFinder, priceIdentifier);

    (
      positionLPInfoArgs.poolInterest,
      positionLPInfoArgs.collateralDeposited
    ) = _getLendingInterest(_getLendingManager(synthFinder));

    positionLPInfoArgs.totalSynthTokens = totalSyntheticAsset;

    positionLPInfoArgs.decimals = collateralDecimals;
    (PositionCache[] memory positionsCache, ) =
      _calculateNewPositions(
        positionLPInfoArgs.poolInterest,
        positionLPInfoArgs.price,
        positionLPInfoArgs.totalSynthTokens,
        positionLPInfoArgs.collateralDeposited,
        positionLPInfoArgs.decimals
      );

    positionLPInfoArgs.overCollateralLimit = overCollateralRequirement;

    positionLPInfoArgs.capacityShares = new uint256[](positionsCache.length);
    positionLPInfoArgs.totalCapacity = _calculateMintShares(
      positionLPInfoArgs.price,
      positionLPInfoArgs.decimals,
      positionsCache,
      positionLPInfoArgs.capacityShares
    );

    LPPosition memory lpPosition;
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
          )
            .div(lpPosition.actualCollateralAmount)
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
   * @notice Returns the lending protocol info
   * @return lendingId Name of the lending module
   * @return bearingToken Address of the bearing token held by the pool for interest accrual
   */
  function lendingProtocolInfo()
    external
    view
    returns (string memory lendingId, address bearingToken)
  {
    lendingId = lendingModuleId;
    bearingToken = _getLendingStorageManager(finder).getInterestBearingToken(
      address(this)
    );
  }

  /**
   * @notice Get Synthereum finder of the pool
   * @return Finder contract
   */
  function synthereumFinder()
    external
    view
    override
    returns (ISynthereumFinder)
  {
    return finder;
  }

  /**
   * @notice Get Synthereum version
   * @return The version of this pool
   */
  function version() external view override returns (uint8) {
    return poolVersion;
  }

  /**
   * @notice Get the collateral token of this pool
   * @return The ERC20 collateral token
   */
  function collateralToken() external view override returns (IERC20) {
    return collateralAsset;
  }

  /**
   * @notice Get the decimals of the collateral
   * @return Number of decimals of the collateral
   */
  function collateralTokenDecimals() external view override returns (uint8) {
    return collateralDecimals;
  }

  /**
   * @notice Get the synthetic token associated to this pool
   * @return The ERC20 synthetic token
   */
  function syntheticToken() external view override returns (IERC20) {
    return syntheticAsset;
  }

  /**
   * @notice Get the synthetic token symbol associated to this pool
   * @return The ERC20 synthetic token symbol
   */
  function syntheticTokenSymbol()
    external
    view
    override
    returns (string memory)
  {
    return IStandardERC20(address(syntheticAsset)).symbol();
  }

  /**
   * @notice Returns the percentage of overcollateralization to which a liquidation can triggered
   * @return Thresold percentage on a liquidation can be triggered
   */
  function collateralRequirement() external view override returns (uint256) {
    return PreciseUnitMath.PRECISE_UNIT + overCollateralRequirement;
  }

  /**
   * @notice Returns the percentage of reward for correct liquidation by a liquidator
   * @return Percentage of reward
   */
  function liquidationReward() external view override returns (uint256) {
    return liquidationBonus;
  }

  /**
   * @notice Returns price identifier of the pool
   * @return Price identifier
   */
  function priceFeedIdentifier() external view override returns (bytes32) {
    return priceIdentifier;
  }

  /**
   * @notice Returns fee percentage of the pool
   * @return Fee percentage
   */
  function feePercentage() external view override returns (uint256) {
    return fee;
  }

  /**
   * @notice Check if the input LP is registered
   * @param _lp Address of the LP
   * @return Return true if the LP is regitered, otherwise false
   */
  function isRegisteredLP(address _lp) public view override returns (bool) {
    return registeredLPs.contains(_lp);
  }

  /**
   * @notice Check if the input LP is active
   * @param _lp Address of the LP
   * @return Return true if the LP is active, otherwise false
   */
  function isActiveLP(address _lp) public view override returns (bool) {
    return activeLPs.contains(_lp);
  }

  /**
   * @notice Set new fee percentage
   * @param _newFee New fee percentage
   */
  function _setFee(uint256 _newFee) internal {
    require(
      _newFee < PreciseUnitMath.PRECISE_UNIT,
      'Fee Percentage must be less than 100%'
    );
    fee = _newFee;
    emit SetFeePercentage(_newFee);
  }

  /**
   * @notice Set new lending module name
   * @param _lendingModuleId Lending module name
   */
  function _setLendingModule(string calldata _lendingModuleId) internal {
    lendingModuleId = _lendingModuleId;
    emit NewLendingModule(_lendingModuleId);
  }

  /**
   * @notice Set new liquidation reward percentage
   * @param _newLiquidationReward New liquidation reward percentage
   */
  function _setLiquidationReward(uint256 _newLiquidationReward) internal {
    require(
      _newLiquidationReward > 0 &&
        _newLiquidationReward <= PreciseUnitMath.PRECISE_UNIT,
      'Liquidation reward must be between 0 and 100%'
    );
    liquidationBonus = _newLiquidationReward;
    emit SetLiquidationReward(_newLiquidationReward);
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

    return _lendingManager.deposit(_collateralAmount, address(this));
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
    (uint256 bearingAmount, address bearingToken) =
      _lendingManager.collateralToInterestToken(
        address(this),
        _collateralAmount
      );

    uint256 amountTransferred =
      IERC20(bearingToken).explicitSafeTransfer(
        address(_lendingManager),
        bearingAmount
      );

    ILendingManager.ReturnValues memory returnValues =
      _lendingManager.withdraw(amountTransferred, _recipient);

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
    IERC20 actualBearingToken =
      IERC20(_lendingStorageManager.getInterestBearingToken(address(this)));
    uint256 actualBearingAmount = actualBearingToken.balanceOf(address(this));
    uint256 amountTransferred =
      actualBearingToken.explicitSafeTransfer(
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
   * @notice Update collateral amount of every LP
   * @param _positionsCache Temporary memory cache containing LPs positions
   */
  function _updateActualLPCollateral(PositionCache[] memory _positionsCache)
    internal
  {
    PositionCache memory lpCache;
    for (uint256 j = 0; j < _positionsCache.length; j++) {
      lpCache = _positionsCache[j];
      lpPositions[lpCache.lp].actualCollateralAmount = lpCache
        .lpPosition
        .actualCollateralAmount;
    }
  }

  /**
   * @notice Update collateral amount and synthetic assets of every LP
   * @param _positionsCache Temporary memory cache containing LPs positions
   */
  function _updateActualLPPositions(PositionCache[] memory _positionsCache)
    internal
  {
    PositionCache memory lpCache;
    LPPosition memory lpPosition;
    for (uint256 j = 0; j < _positionsCache.length; j++) {
      lpCache = _positionsCache[j];
      lpPosition = lpCache.lpPosition;
      lpPositions[lpCache.lp].actualCollateralAmount = lpPosition
        .actualCollateralAmount;
      lpPositions[lpCache.lp].tokensCollateralized = lpPosition
        .tokensCollateralized;
    }
  }

  /**
   * @notice Update collateral amount of every LP and add the new deposit for one LP
   * @param _positionsCache Temporary memory cache containing LPs positions
   * @param _depositingLp Address of the LP depositing collateral
   * @param _increaseCollateral Amount of collateral to increase to the LP
   */
  function _updateAndIncreaseActualLPCollateral(
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
        lpPositions[lp].actualCollateralAmount =
          actualCollateralAmount +
          _increaseCollateral;
      } else {
        lpPositions[lp].actualCollateralAmount = actualCollateralAmount;
      }
    }
  }

  /**
   * @notice Update collateral amount of every LP and removw withdrawal for one LP
   * @param _positionsCache Temporary memory cache containing LPs positions
   * @param _depositingLp Address of the LP withdrawing collateral
   * @param _decreaseCollateral Amount of collateral to decrease from the LP
   * @param _price Actual price of the pair
   * @param _collateralDecimals Decimals of the collateral token
   */
  function _updateAndDecreaseActualLPCollateral(
    PositionCache[] memory _positionsCache,
    address _depositingLp,
    uint256 _decreaseCollateral,
    uint256 _price,
    uint8 _collateralDecimals
  ) internal {
    PositionCache memory lpCache;
    address lp;
    LPPosition memory lpPosition;
    uint256 actualCollateralAmount;
    uint256 newCollateralAmount;
    for (uint256 j = 0; j < _positionsCache.length; j++) {
      lpCache = _positionsCache[j];
      lp = lpCache.lp;
      lpPosition = lpCache.lpPosition;
      actualCollateralAmount = lpPosition.actualCollateralAmount;
      if (lp == _depositingLp) {
        newCollateralAmount = actualCollateralAmount - _decreaseCollateral;
        (bool isOvercollateralized, ) =
          _isOvercollateralizedLP(
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
        lpPositions[lp].actualCollateralAmount = newCollateralAmount;
      } else {
        lpPositions[lp].actualCollateralAmount = actualCollateralAmount;
      }
    }
  }

  /**
   * @notice Update collateral amount of every LP and change overcollateralization for one LP
   * @param _positionsCache Temporary memory cache containing LPs positions
   * @param _lp Address of the LP changing overcollateralization
   * @param _newOverCollateralization New overcollateralization to be set for the LP
   * @param _price Actual price of the pair
   * @param _collateralDecimals Decimals of the collateral token
   */
  function _updateAndModifyActualLPOverCollateral(
    PositionCache[] memory _positionsCache,
    address _lp,
    uint256 _newOverCollateralization,
    uint256 _price,
    uint8 _collateralDecimals
  ) internal {
    PositionCache memory lpCache;
    address lp;
    LPPosition memory lpPosition;
    uint256 actualCollateralAmount;
    for (uint256 j = 0; j < _positionsCache.length; j++) {
      lpCache = _positionsCache[j];
      lp = lpCache.lp;
      lpPosition = lpCache.lpPosition;
      actualCollateralAmount = lpPosition.actualCollateralAmount;
      if (lp == _lp) {
        (bool isOvercollateralized, ) =
          _isOvercollateralizedLP(
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
        lpPositions[lp].actualCollateralAmount = actualCollateralAmount;
        lpPositions[lp].overCollateralization = _newOverCollateralization;
      } else {
        lpPositions[lp].actualCollateralAmount = actualCollateralAmount;
      }
    }
  }

  /**
   * @notice Update collateral amount of every LP and add the new deposit for one LP
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
    PositionCache memory lpCache;
    address lp;
    // LPPosition memory lpPosition;
    uint256 actualCollateralAmount;
    uint256 actualSynthTokens;
    for (uint256 j = 0; j < _positionsCache.length; j++) {
      lpCache = _positionsCache[j];
      lp = lpCache.lp;
      // lpPosition = lpCache.lpPosition;
      actualCollateralAmount = lpCache.lpPosition.actualCollateralAmount;
      actualSynthTokens = lpCache.lpPosition.tokensCollateralized;

      if (lp == _liquidatedLp) {
        tokensToLiquidate = PreciseUnitMath.min(
          _tokensInLiquidation,
          actualSynthTokens
        );
        require(tokensToLiquidate > 0, 'No synthetic tokens to liquidate');

        collateralAmount = _calculateCollateralAmount(
          tokensToLiquidate,
          _liquidationUpdateArgs.tempStorageArgs.price,
          _liquidationUpdateArgs.tempStorageArgs.decimals
        );

        (bool isOvercollateralized, ) =
          _isOvercollateralizedLP(
            actualCollateralAmount,
            _liquidationUpdateArgs.overCollateralRequirement,
            actualSynthTokens,
            _liquidationUpdateArgs.tempStorageArgs.price,
            _liquidationUpdateArgs.tempStorageArgs.decimals
          );
        require(!isOvercollateralized, 'LP is overcollateralized');

        liquidationBonusAmount = actualCollateralAmount
          .mul(liquidationBonus)
          .mul(tokensToLiquidate.div(actualSynthTokens));

        (
          ILendingManager.ReturnValues memory lendingValues,
          WithdrawDust memory withdrawDust
        ) =
          _lendingWithdraw(
            _liquidationUpdateArgs.lendingManager,
            _liquidationUpdateArgs.liquidator,
            collateralAmount + liquidationBonusAmount
          );

        liquidationBonusAmount = withdrawDust.isPositive
          ? liquidationBonusAmount - withdrawDust.amount
          : liquidationBonusAmount + withdrawDust.amount;

        collateralReceived = lendingValues.tokensTransferred;

        lpPositions[lp].actualCollateralAmount =
          actualCollateralAmount -
          liquidationBonusAmount;
        lpPositions[lp].tokensCollateralized =
          actualSynthTokens -
          tokensToLiquidate;
      } else {
        lpPositions[lp].actualCollateralAmount = actualCollateralAmount;
      }
    }
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
   * @param _totalInterests Amount of interests to split between active LPs
   * @param _price Actual price of the pair
   * @param _totalSynthTokens Amount of synthetic asset collateralized by the pool
   * @param _prevTotalCollateral Total amount in the pool before the operation
   * @param _collateralDecimals Decimals of the collateral token
   * @return positionsCache Temporary memory cache containing LPs positions
   * @return prevTotalLPsCollateral Sum of all the LP's collaterals before interests and P&L are charged
   */
  function _calculateNewPositions(
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
    uint256 lpNumbers = activeLPs.length();
    if (lpNumbers > 0) {
      positionsCache = new PositionCache[](lpNumbers);

      prevTotalLPsCollateral = _calculateInterest(
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
   * @param _totalInterests Amount of interests to split between active LPs
   * @param _price Actual price of the pair
   * @param _collateralDecimals Decimals of the collateral token
   * @param _positionsCache Temporary memory cache containing LPs positions
   * @return prevTotalLPsCollateral Sum of all the LP's collaterals before interests are charged
   */
  function _calculateInterest(
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
    LPPosition memory lpPosition;
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
      address lp = activeLPs.at(j);
      LPPosition memory lpPosition = lpPositions[lp];
      uint256 capacityShare =
        _calculateCapacity(lpPosition, _price, _collateralDecimals);
      uint256 utilizationShare =
        _calculateUtilization(lpPosition, _price, _collateralDecimals);
      _capacityShares[j] = capacityShare;
      totalCapacity += capacityShare;
      _utilizationShares[j] = utilizationShare;
      totalUtilization += utilizationShare;
      _positionsCache[j] = PositionCache(
        lp,
        LPPosition(
          lpPosition.actualCollateralAmount,
          lpPosition.tokensCollateralized,
          lpPosition.overCollateralization
        )
      );
      totalLPsCollateral += lpPosition.actualCollateralAmount;
    }
  }

  /**
   * @notice Given a collateral value to be exchanged, returns the fee amount, net collateral and synthetic tokens
   * @param _totCollateralAmount Collateral amount to be exchanged
   * @param _price Actual price of the pair
   * @param _collateralDecimals Decimals of the collateral token
   * @return Return netCollateralAmount, feeAmount and numTokens
   */
  function _calculateMint(
    uint256 _totCollateralAmount,
    uint256 _price,
    uint8 _collateralDecimals
  ) internal view returns (MintValues memory) {
    uint256 feeAmount = _totCollateralAmount.mul(fee);

    uint256 netCollateralAmount = _totCollateralAmount - feeAmount;

    uint256 numTokens =
      _calculateNumberOfTokens(
        netCollateralAmount,
        _price,
        _collateralDecimals
      );

    return
      MintValues(
        _totCollateralAmount,
        netCollateralAmount,
        feeAmount,
        numTokens
      );
  }

  /**
   * @notice Given a an amount of synthetic tokens to be exchanged, returns the fee amount, net collateral and gross collateral
   * @param _numTokens Synthetic tokens amount to be exchanged
   * @param _price Actual price of the pair
   * @param _collateralDecimals Decimals of the collateral token
   * @return Return netCollateralAmount, feeAmount and totCollateralAmount
   */
  function _calculateRedeem(
    uint256 _numTokens,
    uint256 _price,
    uint8 _collateralDecimals
  ) internal view returns (RedeemValues memory) {
    uint256 totCollateralAmount =
      _calculateCollateralAmount(_numTokens, _price, _collateralDecimals);

    uint256 feeAmount = totCollateralAmount.mul(fee);

    uint256 netCollateralAmount = totCollateralAmount - feeAmount;

    return
      RedeemValues(
        _numTokens,
        totCollateralAmount,
        feeAmount,
        netCollateralAmount
      );
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
    ISynthereumPriceFeed priceFeed =
      ISynthereumPriceFeed(
        _finder.getImplementationAddress(SynthereumInterfaces.PriceFeed)
      );

    return priceFeed.getLatestPrice(_priceIdentifier);
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

  /**
   * @notice Return the address of the lendingStorageManager
   * @param _finder Synthereum finder
   * @return Address of the lendingStorageManager
   */
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
    (poolInterests, , collateralDeposited) = _lendingManager
      .getAccumulatedInterest(address(this));
  }

  /**
   * @notice Calculate and returns actual total collateral in the pool (users + Lps)
   * @param _lendingStorageManager Address of lendingStoargeManager
   * @return Return total collateral amount
   */
  function _getTotalCollateral(ILendingStorageManager _lendingStorageManager)
    internal
    view
    returns (uint256)
  {
    (ILendingStorageManager.PoolStorage memory poolStorage, ) =
      _lendingStorageManager.getPoolStorage(address(this));
    return poolStorage.collateralDeposited;
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

    uint256 totalAssetValue =
      _calculateCollateralAmount(
        _totalSynthTokens,
        _price,
        _collateralDecimals
      );

    bool isLpGain = totalAssetValue < _totalUserAmount;

    uint256 totalProfitOrLoss =
      isLpGain
        ? _totalUserAmount - totalAssetValue
        : totalAssetValue - _totalUserAmount;

    uint256 remainingProfitOrLoss = totalProfitOrLoss;
    LPPosition memory lpPosition;
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
   * @notice Calculate fee and synthetic asset of each Lp in a mint transaction
   * @param _mintValues ExchangeAmount, feeAmount and numTokens
   * @param _price Actual price of the pair
   * @param _collateralDecimals Decimals of the collateral token
   * @param _positionsCache Temporary memory cache containing LPs positions
   */
  function _calculateMintTokensAndFee(
    MintValues memory _mintValues,
    uint256 _price,
    uint8 _collateralDecimals,
    PositionCache[] memory _positionsCache
  ) internal pure {
    uint256 lpNumbers = _positionsCache.length;

    uint256[] memory capacityShares = new uint256[](lpNumbers);
    uint256 totalCapacity =
      _calculateMintShares(
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
    (bool isOvercollateralized, ) =
      _isOvercollateralizedLP(
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
    LPPosition memory lpPosition;
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
    uint256 prevTotalAmount =
      _migrationValues.prevTotalCollateral + _migrationValues.poolInterest;
    bool isLpGain = _migrationValues.actualTotalCollateral > prevTotalAmount;
    uint256 globalLpsProfitOrLoss =
      isLpGain
        ? _migrationValues.actualTotalCollateral - prevTotalAmount
        : prevTotalAmount - _migrationValues.actualTotalCollateral;
    if (globalLpsProfitOrLoss == 0) return;

    LPPosition memory lpPosition;
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
   * @notice Calculate capacity in tokens of each LP
   * @dev Utilization = (actualCollateralAmount / overCollateralization) * price - tokensCollateralized
   * @dev Return 0 if underCollateralized
   * @param _lpPosition Actual LP position
   * @param _price Actual price of the pair
   * @param _collateralDecimals Decimals of the collateral token
   * @return Capacity of the LP
   */
  function _calculateCapacity(
    LPPosition memory _lpPosition,
    uint256 _price,
    uint8 _collateralDecimals
  ) internal pure returns (uint256) {
    uint256 maxCapacity =
      _calculateNumberOfTokens(
        _lpPosition.actualCollateralAmount.div(
          _lpPosition.overCollateralization
        ),
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
    LPPosition memory _lpPosition,
    uint256 _price,
    uint8 _collateralDecimals
  ) internal pure returns (uint256) {
    return
      _lpPosition.actualCollateralAmount != 0
        ? PreciseUnitMath.min(
          _calculateCollateralAmount(
            _lpPosition
              .tokensCollateralized,
            _price,
            _collateralDecimals
          )
            .mul(_lpPosition.overCollateralization)
            .div(_lpPosition.actualCollateralAmount),
          PreciseUnitMath.PRECISE_UNIT
        )
        : _lpPosition.tokensCollateralized > 0
        ? PreciseUnitMath.PRECISE_UNIT
        : 0;
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

  /**
   * @notice Check if an address is the trusted forwarder
   * @param  forwarder Address to check
   * @return True is the input address is the trusted forwarder, otherwise false
   */
  function isTrustedForwarder(address forwarder)
    public
    view
    override
    returns (bool)
  {
    try
      finder.getImplementationAddress(SynthereumInterfaces.TrustedForwarder)
    returns (address trustedForwarder) {
      if (forwarder == trustedForwarder) {
        return true;
      } else {
        return false;
      }
    } catch {
      return false;
    }
  }

  function _msgSender()
    internal
    view
    override(ERC2771Context, Context)
    returns (address sender)
  {
    return ERC2771Context._msgSender();
  }

  function _msgData()
    internal
    view
    override(ERC2771Context, Context)
    returns (bytes calldata)
  {
    return ERC2771Context._msgData();
  }
}
