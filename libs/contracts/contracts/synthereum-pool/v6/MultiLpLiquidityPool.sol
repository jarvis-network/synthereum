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
import {SynthereumInterfaces} from '../../core/Constants.sol';
import {
  EnumerableSet
} from '@openzeppelin/contracts/utils/structs/EnumerableSet.sol';
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

  struct ConstructorParams {
    // Synthereum finder
    ISynthereumFinder finder;
    // Synthereum pool version
    uint8 version;
    // ERC20 collateral token
    IStandardERC20 collateralToken;
    // ERC20 synthetic token
    IMintableBurnableERC20 syntheticToken;
    // The addresses of admin, maintainer, liquidity provider
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

  //----------------------------------------
  // Constants
  //----------------------------------------

  string public constant override typology = 'POOL';

  bytes32 public constant MAINTAINER_ROLE = keccak256('Maintainer');

  uint256 private constant SCALING_UNIT = 10**18;

  uint8 private immutable poolVersion;

  ISynthereumFinder private immutable finder;

  IStandardERC20 private immutable collateralAsset;

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

  constructor(ConstructorParams memory params) nonReentrant {
    require(
      params.collateralRequirement > SCALING_UNIT,
      'Collateral requirement must be bigger than 100%'
    );

    require(
      params.collateralToken.decimals() <= 18,
      'Collateral has more than 18 decimals'
    );

    require(
      params.syntheticToken.decimals() == 18,
      'Synthetic token has more or less than 18 decimals'
    );

    ISynthereumPriceFeed priceFeed =
      ISynthereumPriceFeed(
        params.finder.getImplementationAddress(SynthereumInterfaces.PriceFeed)
      );
    require(
      priceFeed.isPriceSupported(params.priceIdentifier),
      'Price identifier not supported'
    );

    finder = params.finder;
    poolVersion = params.version;
    collateralAsset = params.collateralToken;
    syntheticAsset = params.syntheticToken;
    priceIdentifier = params.priceIdentifier;
    liquidationThreshold = params.collateralRequirement;

    _setLiquidationReward(params.liquidationReward);
    _setFee(params.fee);

    _setRoleAdmin(DEFAULT_ADMIN_ROLE, DEFAULT_ADMIN_ROLE);
    _setRoleAdmin(MAINTAINER_ROLE, DEFAULT_ADMIN_ROLE);
    _setupRole(DEFAULT_ADMIN_ROLE, params.roles.admin);
    _setupRole(MAINTAINER_ROLE, params.roles.maintainer);
  }

  /**
   * @notice Register a liquidity provider to the LP's whitelist
   * @notice This can be called only by the maintainer
   * @param lp Address of the LP
   */
  function registerLP(address lp)
    external
    override
    nonReentrant
    onlyMaintainer
  {
    require(registeredLPs.add(lp), 'LP already registered');
    emit RegisteredLp(lp);
  }

  /**
   * @notice Add the Lp to the active list of the LPs
   * @notice Only a registered and inactive LP can call this function to add himself
   * @param collateralAmount Collateral amount to deposit by the LP
   * @param overCollateralization Overcollateralization to set by the LP
   */
  function activateLP(uint256 collateralAmount, uint256 overCollateralization)
    external
    override
    nonReentrant
  {
    address msgSender = _msgSender();
    LPPosition storage position = lpPositions[msgSender];
    require(isRegisteredLP(msgSender), 'Sender must be a registered LP');
    require(collateralAmount > 0, 'No collateral deposited');
    require(
      overCollateralization > liquidationThreshold - SCALING_UNIT,
      'Overcollateralization must be bigger than the Lp part of the collateral requirement'
    );
    require(activeLPs.add(msgSender), 'LP already active');
    //TO DO: update P&L and deposit in lending module

    position.actualCollateralAmount = collateralAmount;
    position.overCollateralization = overCollateralization;
    emit ActivatedLP(msgSender, collateralAmount, overCollateralization);
  }

  /**
   * @notice Set new liquidation reward percentage
   * @notice This can be called only by the maintainer
   * @param newLiquidationReward New liquidation reward percentage
   */
  function setLiquidationReward(uint256 newLiquidationReward)
    external
    override
    nonReentrant
    onlyMaintainer
  {
    _setLiquidationReward(newLiquidationReward);
  }

  /**
   * @notice Set new fee percentage
   * @notice This can be called only by the maintainer
   * @param newFee New fee percentage
   */
  function setFee(uint256 newFee)
    external
    override
    nonReentrant
    onlyMaintainer
  {
    _setFee(fee);
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
   * @notice Address of the LP
   * @return Return the position of the LP if it's active, otherwise revert
   */
  function getLpPosition(address lp)
    external
    view
    override
    returns (LPPosition memory)
  {
    require(isActiveLP(lp), 'Lp is not active');
    return lpPositions[lp];
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
   * @notice Address of the LP
   * @return Return true if the LP is regitered, otherwise false
   */
  function isRegisteredLP(address lp) public view override returns (bool) {
    return registeredLPs.contains(lp);
  }

  /**
   * @notice Check if the input LP is active
   * @notice Address of the LP
   * @return Return true if the LP is active, otherwise false
   */
  function isActiveLP(address lp) public view override returns (bool) {
    return activeLPs.contains(lp);
  }

  /**
   * @notice Set new fee percentage
   * @param newFee New fee percentage
   */
  function _setFee(uint256 newFee) internal {
    require(newFee < SCALING_UNIT, 'Fee Percentage must be less than 100%');
    fee = newFee;
    emit SetFeePercentage(newFee);
  }

  /**
   * @notice Set new liquidation reward percentage
   * @param newLiquidationReward New liquidation reward percentage
   */
  function _setLiquidationReward(uint256 newLiquidationReward) internal {
    require(
      newLiquidationReward > 0 && newLiquidationReward < SCALING_UNIT,
      'Liquidation reward must be between 0 and 100%'
    );
    liquidationBonus = newLiquidationReward;
    emit SetLiquidationReward(newLiquidationReward);
  }
}
