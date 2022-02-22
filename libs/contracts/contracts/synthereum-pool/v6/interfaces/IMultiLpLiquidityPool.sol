// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity >=0.8.0;

import {ITypology} from '../../../common/interfaces/ITypology.sol';
import {
  ISynthereumDeployment
} from '../../../common/interfaces/IDeployment.sol';
import {
  FixedPoint
} from '@uma/core/contracts/common/implementation/FixedPoint.sol';

/**
 * @title Multi LP pool interface
 */
interface ISynthereumMultiLpLiquidityPool is ITypology, ISynthereumDeployment {
  // Describe role structure
  struct Roles {
    address admin;
    address maintainer;
  }

  struct LPPosition {
    // Actual collateral owned
    uint256 actualCollateralAmount;
    // Number of tokens collateralized
    uint256 tokensCollateralized;
    // Overcolalteralization percentage
    uint256 overCollateralization;
  }

  /**
   * @notice Register a liquidity provider to the LP's whitelist
   * @notice This can be called only by the maintainer
   * @param _lp Address of the LP
   */
  function registerLP(address _lp) external;

  /**
   * @notice Add the Lp to the active list of the LPs
   * @notice Only a registered and inactive LP can call this function to add himself
   * @param _collateralAmount Collateral amount to deposit by the LP
   * @param _overCollateralization Overcollateralization to set by the LP
   */
  function activateLP(uint256 _collateralAmount, uint256 _overCollateralization)
    external;

  /**
   * @notice Add collateral to an active LP position
   * @notice Only an active LP can call this function to add collateral to his position
   * @param _collateralAmount Collateral amount to deposit by the LP
   */
  function addLiquidity(uint256 _collateralAmount) external;

  /**
   * @notice Set new liquidation reward percentage
   * @notice This can be called only by the maintainer
   * @param _newLiquidationReward New liquidation reward percentage
   */
  function setLiquidationReward(uint256 _newLiquidationReward) external;

  /**
   * @notice Set new fee percentage
   * @notice This can be called only by the maintainer
   * @param _fee New fee percentage
   */
  function setFee(uint256 _fee) external;

  /**
   * @notice Get all the registered LPs of this pool
   * @return The list of addresses of all the registered LPs in the pool.
   */
  function getRegisteredLPs() external view returns (address[] memory);

  /**
   * @notice Get all the active LPs of this pool
   * @return The list of addresses of all the active LPs in the pool.
   */
  function getActiveLPs() external view returns (address[] memory);

  /**
   * @notice Get the position of an LP
   * @param _lp Address of the LP
   * @return Return the position of the LP if it's active, otherwise revert
   */
  function getLpPosition(address _lp) external view returns (LPPosition memory);

  /**
   * @notice Check if the input LP is registered
   * @param _lp Address of the LP
   * @return Return true if the LP is regitered, otherwise false
   */
  function isRegisteredLP(address _lp) external view returns (bool);

  /**
   * @notice Check if the input LP is active
   * @param _lp Address of the LP
   * @return Return true if the LP is active, otherwise false
   */
  function isActiveLP(address _lp) external view returns (bool);

  /**
   * @notice Returns the percentage of overcollateralization to which a liquidation can triggered
   * @return Thresold percentage on a liquidation can be triggered
   */
  function collateralRequirement() external view returns (uint256);

  /**
   * @notice Returns the percentage of reward for correct liquidation by a liquidator
   * @return Percentage of reward
   */
  function liquidationReward() external view returns (uint256);

  /**
   * @notice Returns price identifier of the pool
   * @return Price identifier
   */
  function priceFeedIdentifier() external view returns (bytes32);

  /**
   * @notice Returns fee percentage of the pool
   * @return Fee percentage
   */
  function feePercentage() external view returns (uint256);
}
