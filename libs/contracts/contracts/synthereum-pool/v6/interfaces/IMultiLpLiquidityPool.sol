// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity >0.8.0;

import {ITypology} from '../../../common/interfaces/ITypology.sol';

/**
 * @title Multi LP pool interface
 */
interface ISynthereumMultiLpLiquidityPool is ITypology {
  /**
   * @notice Register a liquidity provider to the LP's whitelist
   * @notice This can be called only by the maintainer
   * @param lp Address of the LP
   */
  function registerLP(address lp) external;

  /**
   * @notice Get all the registered LPs of this pool
   * @return The list of addresses of all the registered LPs in the pool.
   */
  function getRegisteredLPs() external view returns (address[] memory);
}
