// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity >0.8.0;

import {ITypology} from '../../../common/interfaces/ITypology.sol';

/**
 * @title Multi LP pool interface
 */
interface ISynthereumMultiLpLiquidityPool is ITypology {
  /**
   * @notice Add a liquidity pool to the LP's whitelist
   * @notice This can be called only by the maintainer
   * @param lp Address of the LP
   */
  function addLP(address lp) external;

  /**
   * @notice Get all the LPs of this pool
   * @return The list of addresses of all the active LPs in the pool.
   */
  function getLPs() external view returns (address[] memory);
}
