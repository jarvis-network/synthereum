// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity 0.8.9;

import {SynthereumMultiLpLiquidityPool} from './MultiLpLiquidityPool.sol';

/**
 * @title Library containing only the MultiLpContract for the deployment to prevent exceeding bytes of the factory
 */
library SynthereumMultiLpLiquidityPoolCreatorLib {
  //----------------------------------------
  // External functions
  //----------------------------------------

  /**
   * @notice Creates an instance of the pool
   * @param params is a `ConstructorParams` object from LiquidityPool.
   * @return pool address of the deployed pool contract.
   */
  function deployPool(
    SynthereumMultiLpLiquidityPool.ConstructorParams calldata params
  ) external returns (SynthereumMultiLpLiquidityPool pool) {
    pool = new SynthereumMultiLpLiquidityPool(params);
  }
}
