// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity >0.8.0;

interface ISynthereumMultiLpLiquidityPoolEvents {
  /**
   * @notice Emitted when a LP is added to the pool by the maintainer
   * @param lp Address of the LP to be added
   */
  event AddedLp(address lp);
}
