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
import {ILendingProxy} from '../../lending-module/interfaces/ILendingProxy.sol';
import {SynthereumInterfaces} from '../../core/Constants.sol';
import {
  SafeERC20
} from '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import {
  EnumerableSet
} from '@openzeppelin/contracts/utils/structs/EnumerableSet.sol';
import {PreciseUnitMath} from '../../base/utils/PreciseUnitMath.sol';
import {
  ReentrancyGuard
} from '@openzeppelin/contracts/security/ReentrancyGuard.sol';
import {
  AccessControlEnumerable
} from '@openzeppelin/contracts/access/AccessControlEnumerable.sol';

/**
 * @title Multi LP Synthereum pool
 */
contract SynthereumMultiLpLiquidityPool is
  ISynthereumMultiLpLiquidityPoolEvents,
  ISynthereumMultiLpLiquidityPool,
  ReentrancyGuard,
  AccessControlEnumerable
{
  using EnumerableSet for EnumerableSet.AddressSet;
  using PreciseUnitMath for uint256;
  using SafeERC20 for IStandardERC20;
  using SafeERC20 for IERC20;

  struct ConstructorParams {
    // Synthereum finder
    ISynthereumFinder finder;
    // Synthereum pool version
    uint8 version;
    // ERC20 collateral token
    IStandardERC20 collateralToken;
    // ERC20 synthetic token
    IMintableBurnableERC20 syntheticToken;
    // The addresses of admin and maintainer
    Roles roles;
    // The fee percentage
    uint256 fee;
    // Identifier of price to be used in the price feed
    bytes32 priceIdentifier;
    // Percentage of overcollateralization to which a liquidation can triggered
    uint256 collateralRequirement;
    // Percentage of reward for correct liquidation by a liquidator
    uint256 liquidationReward;
  }

  struct PositionCache {
    address lp;
    LPPosition lpPosition;
  }

  //----------------------------------------
  // Constants
  //----------------------------------------

  string public constant override typology = 'POOL';

  bytes32 public constant MAINTAINER_ROLE = keccak256('Maintainer');

  uint8 private immutable poolVersion;

  ISynthereumFinder private immutable finder;

  IStandardERC20 private immutable collateralAsset;

  uint8 private immutable collateralDecimals;

  IMintableBurnableERC20 private immutable syntheticAsset;

  bytes32 private immutable priceIdentifier;

  uint256 private immutable liquidationThreshold;

  //----------------------------------------
  // Storage
  //----------------------------------------

  uint256 private fee;

  uint256 private liquidationBonus;

  EnumerableSet.AddressSet private registeredLPs;

  EnumerableSet.AddressSet private activeLPs;

  mapping(address => LPPosition) private lpPositions;

  uint256 private totalSyntheticAsset;

  uint256 private totalUserDeposits;

  //----------------------------------------
  // Modifiers
  //----------------------------------------

  modifier onlyMaintainer() {
    require(
      hasRole(MAINTAINER_ROLE, _msgSender()),
      'Sender must be the maintainer'
    );
    _;
  }

  constructor(ConstructorParams memory _params) nonReentrant {
    require(
      _params.collateralRequirement > PreciseUnitMath.PRECISE_UNIT,
      'Collateral requirement must be bigger than 100%'
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
    liquidationThreshold = _params.collateralRequirement;

    _setLiquidationReward(_params.liquidationReward);
    _setFee(_params.fee);

    _setRoleAdmin(DEFAULT_ADMIN_ROLE, DEFAULT_ADMIN_ROLE);
    _setRoleAdmin(MAINTAINER_ROLE, DEFAULT_ADMIN_ROLE);
    _setupRole(DEFAULT_ADMIN_ROLE, _params.roles.admin);
    _setupRole(MAINTAINER_ROLE, _params.roles.maintainer);
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
      _overCollateralization >
        liquidationThreshold - PreciseUnitMath.PRECISE_UNIT,
      'Overcollateralization must be bigger than the Lp part of the collateral requirement'
    );

    ILendingProxy lendingManager = _getLendingManager(finder);
    collateralAsset.safeTransferFrom(
      msgSender,
      address(lendingManager),
      _collateralAmount
    );
    ILendingProxy.ReturnValues memory lendingValues =
      lendingManager.deposit(_collateralAmount);

    (
      bool isLpGain,
      uint256 totalProfitOrLoss,
      PositionCache[] memory positionsCache
    ) =
      _calculateNewPositions(
        lendingValues.poolInterest,
        _getPriceFeedRate(finder, priceIdentifier),
        totalSyntheticAsset,
        totalUserDeposits
      );

    _updateActualLPCollateral(positionsCache);
    totalUserDeposits = isLpGain
      ? totalUserDeposits - totalProfitOrLoss
      : totalUserDeposits + totalProfitOrLoss;

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

    require(_collateralAmount > 0, 'No collateral deposited');
    require(isActiveLP(msgSender), 'Sender must be an active LP');

    ILendingProxy lendingManager = _getLendingManager(finder);
    collateralAsset.safeTransferFrom(
      msgSender,
      address(lendingManager),
      _collateralAmount
    );
    ILendingProxy.ReturnValues memory lendingValues =
      lendingManager.deposit(_collateralAmount);

    uint256 price = _getPriceFeedRate(finder, priceIdentifier);

    (
      bool isLpGain,
      uint256 totalProfitOrLoss,
      PositionCache[] memory positionsCache
    ) =
      _calculateNewPositions(
        lendingValues.poolInterest,
        price,
        totalSyntheticAsset,
        totalUserDeposits
      );

    collateralDeposited = lendingValues.tokensOut;
    _updateAndModifyActualLPCollateral(
      positionsCache,
      msgSender,
      true,
      collateralDeposited,
      price
    );
    totalUserDeposits = isLpGain
      ? totalUserDeposits - totalProfitOrLoss
      : totalUserDeposits + totalProfitOrLoss;

    emit DepositedLiquidity(msgSender, _collateralAmount, collateralDeposited);
  }

  /**
   * @notice Withdraw collateral from an active LP position
   * @notice Only an active LP can call this function to withdraw collateral from his position
   * @param _collateralAmount Collateral amount to withdraw by the LP
   * @param collateralWithdrawn Net collateral withdrawn from the LP position
   */
  function removeLiquidity(uint256 _collateralAmount)
    external
    override
    nonReentrant
    returns (uint256 collateralWithdrawn)
  {
    address msgSender = _msgSender();

    require(isActiveLP(msgSender), 'Sender must be an active LP');
    require(_collateralAmount > 0, 'No collateral deposited');

    ILendingProxy lendingManager = _getLendingManager(finder);
    (uint256 bearingAmount, address bearingToken) =
      lendingManager.collateralToInterestToken(_collateralAmount, true);
    IERC20(bearingToken).safeTransfer(address(lendingManager), bearingAmount);
    ILendingProxy.ReturnValues memory lendingValues =
      lendingManager.withdraw(bearingAmount, msgSender);

    uint256 price = _getPriceFeedRate(finder, priceIdentifier);

    (
      bool isLpGain,
      uint256 totalProfitOrLoss,
      PositionCache[] memory positionsCache
    ) =
      _calculateNewPositions(
        lendingValues.poolInterest,
        price,
        totalSyntheticAsset,
        totalUserDeposits
      );

    collateralWithdrawn = lendingValues.tokensOut;
    _updateAndModifyActualLPCollateral(
      positionsCache,
      msgSender,
      false,
      collateralWithdrawn,
      price
    );
    totalUserDeposits = isLpGain
      ? totalUserDeposits - totalProfitOrLoss
      : totalUserDeposits + totalProfitOrLoss;

    emit WithdrawnLiquidity(msgSender, _collateralAmount, collateralWithdrawn);
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
   * @notice Get the position of an LP
   * @param _lp Address of the LP
   * @return Return the position of the LP if it's active, otherwise revert
   */
  function getLpPosition(address _lp)
    external
    view
    override
    returns (LPPosition memory)
  {
    require(isActiveLP(_lp), 'Lp is not active');
    return lpPositions[_lp];
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
    return liquidationThreshold;
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
   * @notice Update collateral amount of every LP
   * @param _positionsCache Temporary memory cache containing LPs positions
   */
  function _updateActualLPCollateral(PositionCache[] memory _positionsCache)
    internal
  {
    for (uint256 j = 0; j < _positionsCache.length; j++) {
      PositionCache memory lpCache = _positionsCache[j];
      lpPositions[lpCache.lp].actualCollateralAmount = lpCache
        .lpPosition
        .actualCollateralAmount;
    }
  }

  /**
   * @notice Update collateral amount of every LP and add the new deposit for one LP
   * @param _positionsCache Temporary memory cache containing LPs positions
   * @param _depositingLp Address of the LP depositing collateral
   * @param _isIncreased True if collateral to add for the LP, otherwise false
   * @param _changingCollateral Amount of collateral to increase/decrease to/from the LP
   * @param _price Actual price of the pair
   */
  function _updateAndModifyActualLPCollateral(
    PositionCache[] memory _positionsCache,
    address _depositingLp,
    bool _isIncreased,
    uint256 _changingCollateral,
    uint256 _price
  ) internal {
    for (uint256 j = 0; j < _positionsCache.length; j++) {
      PositionCache memory lpCache = _positionsCache[j];
      address lp = lpCache.lp;
      LPPosition memory lpPosition = _positionsCache[j].lpPosition;
      uint256 actualCollateralAmount = lpPosition.actualCollateralAmount;
      if (lp == _depositingLp) {
        if (_isIncreased) {
          lpPositions[lp].actualCollateralAmount =
            actualCollateralAmount +
            _changingCollateral;
        } else {
          uint256 newCollateralAmount =
            actualCollateralAmount - _changingCollateral;
          require(
            _isOvercollateralizedLP(
              newCollateralAmount,
              lpPosition.tokensCollateralized,
              lpPosition.overCollateralization,
              _price
            ),
            'LP is undercollateralized'
          );
          lpPositions[lp].actualCollateralAmount = newCollateralAmount;
        }
      } else {
        lpPositions[lp].actualCollateralAmount = actualCollateralAmount;
      }
    }
  }

  /**
   * @notice Calculate new positons from previous interaction
   * @param _totalInterests Amount of interests to split between active LPs
   * @param _price Actual price of the pair
   * @param _totalSynthTokens Amount of synthetic asset collateralized by the pool
   * @param _totalUserAmount Actual amount deposited by the users
   * @return isLpGain True if the lps have a gain over users otherwise false
   * @return totalProfitOrLoss Profit or loss of the Lps over the users
   * @return positionsCache Temporary memory cache containing LPs positions
   */
  function _calculateNewPositions(
    uint256 _totalInterests,
    uint256 _price,
    uint256 _totalSynthTokens,
    uint256 _totalUserAmount
  )
    internal
    view
    returns (
      bool isLpGain,
      uint256 totalProfitOrLoss,
      PositionCache[] memory positionsCache
    )
  {
    _calculateInterest(_totalInterests, _price, positionsCache);
    (isLpGain, totalProfitOrLoss) = _calculateProfitAndLoss(
      _price,
      _totalSynthTokens,
      _totalUserAmount,
      positionsCache
    );
  }

  /**
   * @notice Calculate interests of each Lp
   * @param _totalInterests Amount of interests to split between active LPs
   * @param _price Actual price of the pair
   * @param _positionsCache Temporary memory cache containing LPs positions
   */
  function _calculateInterest(
    uint256 _totalInterests,
    uint256 _price,
    PositionCache[] memory _positionsCache
  ) internal view {
    uint256 lpNumbers = activeLPs.length();
    uint256[] memory capacityShares = new uint256[](lpNumbers);
    uint256[] memory utilizationShares = new uint256[](lpNumbers);
    (uint256 totalCapacity, uint256 totalUtilization) =
      _calculateInterestShares(
        _price,
        _positionsCache,
        capacityShares,
        utilizationShares
      );
    uint256 remainingInterest = _totalInterests;
    for (uint256 j = 0; j < lpNumbers - 1; j++) {
      uint256 interest =
        _totalInterests.mul(
          ((capacityShares[j].div(totalCapacity)) +
            (utilizationShares[j].div(totalUtilization))) / 2
        );
      LPPosition memory lpPosition = _positionsCache[j].lpPosition;
      lpPosition.actualCollateralAmount =
        lpPosition.actualCollateralAmount +
        interest;
      remainingInterest = remainingInterest - interest;
    }
    LPPosition memory lastLpPosition =
      _positionsCache[lpNumbers - 1].lpPosition;
    lastLpPosition.actualCollateralAmount =
      lastLpPosition.actualCollateralAmount +
      remainingInterest;
  }

  /**
   * @notice Calculate interest shares of each LP
   * @param _price Actual price of the pair
   * @param _positionsCache Temporary memory cache containing LPs positions
   * @param _capacityShares Array to be populated with the capacity shares of every LP
   * @param _utilizationShares Array to be populated with the utilization shares of every LP
   * @return totalCapacity Sum of all the LP's capacities
   * @return totalUtilization Sum of all the LP's utilizations
   */
  function _calculateInterestShares(
    uint256 _price,
    PositionCache[] memory _positionsCache,
    uint256[] memory _capacityShares,
    uint256[] memory _utilizationShares
  ) internal view returns (uint256 totalCapacity, uint256 totalUtilization) {
    for (uint256 j = 0; j < _positionsCache.length; j++) {
      address lp = activeLPs.at(j);
      LPPosition memory lpPosition = lpPositions[lp];
      uint256 capacityShare =
        _calculateCapacity(
          lpPosition.actualCollateralAmount,
          lpPosition.tokensCollateralized,
          lpPosition.overCollateralization,
          _price
        );
      uint256 utilizationShare =
        _calculateUtilization(
          lpPosition.actualCollateralAmount,
          lpPosition.tokensCollateralized,
          lpPosition.overCollateralization,
          _price
        );
      _capacityShares[j] = capacityShare;
      totalCapacity = totalCapacity + capacityShare;
      _utilizationShares[j] = utilizationShare;
      totalCapacity = totalUtilization + utilizationShare;
      _positionsCache[j] = PositionCache(
        lp,
        LPPosition(
          lpPosition.actualCollateralAmount,
          lpPosition.tokensCollateralized,
          lpPosition.overCollateralization
        )
      );
    }
  }

  /**
   * @notice Calculate profit or loss of each Lp
   * @param _price Actual price of the pair
   * @param _totalSynthTokens Amount of synthetic asset collateralized by the pool
   * @param _totalUserAmount Actual amount deposited by the users
   * @param _positionsCache Temporary memory cache containing LPs positions
   * @return isLpGain True if the lps have a gain over users otherwise false
   * @return totalProfitOrLoss Profit or loss of the Lps over the users
   */
  function _calculateProfitAndLoss(
    uint256 _price,
    uint256 _totalSynthTokens,
    uint256 _totalUserAmount,
    PositionCache[] memory _positionsCache
  ) internal view returns (bool isLpGain, uint256 totalProfitOrLoss) {
    uint256 lpNumbers = _positionsCache.length;
    uint256 totalAssetValue =
      calculateCollateralAmount(_totalSynthTokens, _price);
    isLpGain = totalAssetValue < _totalUserAmount;
    if (isLpGain) {
      totalProfitOrLoss = _totalUserAmount - totalAssetValue;
      uint256 remainingProfit = totalProfitOrLoss;
      for (uint256 j = 0; j < lpNumbers - 1; j++) {
        LPPosition memory lpPosition = _positionsCache[j].lpPosition;
        uint256 assetRatio =
          lpPosition.tokensCollateralized.div(_totalSynthTokens);
        uint256 lpProfit = totalProfitOrLoss.mul(assetRatio);
        lpPosition.actualCollateralAmount =
          lpPosition.actualCollateralAmount +
          lpProfit;
        remainingProfit = remainingProfit - lpProfit;
      }
      LPPosition memory lastLpPosition =
        _positionsCache[lpNumbers - 1].lpPosition;
      lastLpPosition.actualCollateralAmount =
        lastLpPosition.actualCollateralAmount +
        remainingProfit;
    } else {
      totalProfitOrLoss = totalAssetValue - _totalUserAmount;
      uint256 remainingLoss = totalProfitOrLoss;
      for (uint256 j = 0; j < lpNumbers - 1; j++) {
        LPPosition memory lpPosition = _positionsCache[j].lpPosition;
        uint256 assetRatio =
          lpPosition.tokensCollateralized.div(_totalSynthTokens);
        uint256 lpLoss = totalProfitOrLoss.mul(assetRatio);
        lpPosition.actualCollateralAmount =
          lpPosition.actualCollateralAmount -
          lpLoss;
        remainingLoss = remainingLoss - lpLoss;
      }
      LPPosition memory lastLpPosition =
        _positionsCache[lpNumbers - 1].lpPosition;
      lastLpPosition.actualCollateralAmount =
        lastLpPosition.actualCollateralAmount -
        remainingLoss;
    }
  }

  /**
   * @notice Return the on-chain oracle price for a pair
   * @param _finder Synthereum finder
   * @param _priceIdentifier Identifier of price pair
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
   * @notice Return the address of the lending manager
   * @param _finder Synthereum finder
   * @return Address of the lending manager
   */
  function _getLendingManager(ISynthereumFinder _finder)
    internal
    view
    returns (ILendingProxy)
  {
    return
      ILendingProxy(
        _finder.getImplementationAddress(SynthereumInterfaces.LendingManager)
      );
  }

  /**
   * @notice Calculate capacity of each LP
   * @dev Utilization = (actualCollateralAmount / overCollateralization) - (tokensCollateralized * price)
   * @param _actualCollateralAmount Actual collateral amount holded by the LP
   * @param _tokensCollateralized Actual amount of syntehtic asset collateralized by the LP
   * @param _overCollateralization Overcollateralization of the LP
   * @param _price Actual price of the pair
   * @return Capacity of the LP
   */
  function _calculateCapacity(
    uint256 _actualCollateralAmount,
    uint256 _tokensCollateralized,
    uint256 _overCollateralization,
    uint256 _price
  ) internal view returns (uint256) {
    return
      (_actualCollateralAmount.div(_overCollateralization)) -
      calculateCollateralAmount(_tokensCollateralized, _price);
  }

  /**
   * @notice Calculate utilization of an LP
   * @dev Utilization = (tokensCollateralized * price * overCollateralization) / actualCollateralAmount
   * @dev Capped to 1 in case of underCollateralization
   * @param _actualCollateralAmount Actual collateral amount holded by the LP
   * @param _tokensCollateralized Actual amount of syntehtic asset collateralized by the LP
   * @param _overCollateralization Overcollateralization of the LP
   * @param _price Actual price of the pair
   * @return Utilization of the LP
   */
  function _calculateUtilization(
    uint256 _actualCollateralAmount,
    uint256 _tokensCollateralized,
    uint256 _overCollateralization,
    uint256 _price
  ) internal view returns (uint256) {
    return
      PreciseUnitMath.min(
        calculateCollateralAmount(_tokensCollateralized, _price)
          .mul(_overCollateralization)
          .div(_actualCollateralAmount),
        PreciseUnitMath.PRECISE_UNIT
      );
  }

  /**
   * @notice Return if an LP is overcollateralized
   * @param _actualCollateralAmount Actual collateral amount holded by the LP
   * @param _tokensCollateralized Actual amount of syntehtic asset collateralized by the LP
   * @param _overCollateralization Overcollateralization of the LP
   * @param _price Actual price of the pair
   * @return True if LP is overcollateralized otherwise false
   */
  function _isOvercollateralizedLP(
    uint256 _actualCollateralAmount,
    uint256 _tokensCollateralized,
    uint256 _overCollateralization,
    uint256 _price
  ) internal view returns (bool) {
    return
      _actualCollateralAmount.div(_overCollateralization) >=
      calculateCollateralAmount(_tokensCollateralized, _price);
  }

  /**
   * @notice Calculate collateral amount starting from an amount of synthtic token
   * @param _numTokens Amount of synthetic tokens used for the conversion
   * @param _price Actual price of the pair
   * @return Amount of collateral after on-chain oracle conversion
   */
  function calculateCollateralAmount(uint256 _numTokens, uint256 _price)
    internal
    view
    returns (uint256)
  {
    return _numTokens.mul(_price) / (10**(18 - collateralDecimals));
  }
}
