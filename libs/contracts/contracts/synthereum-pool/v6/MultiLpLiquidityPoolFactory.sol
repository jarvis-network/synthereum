// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity 0.8.9;

import {
  IDeploymentSignature
} from '../../core/interfaces/IDeploymentSignature.sol';
import {
  SynthereumMultiLpLiquidityPoolCreator
} from './MultiLpLiquidityPoolCreator.sol';
import {
  ISynthereumMultiLpLiquidityPool
} from './interfaces/IMultiLpLiquidityPool.sol';
import {FactoryConditions} from '../../common/FactoryConditions.sol';
import {
  ReentrancyGuard
} from '@openzeppelin/contracts/security/ReentrancyGuard.sol';

contract SynthereumMultiLpLiquidityPoolFactory is
  IDeploymentSignature,
  ReentrancyGuard,
  FactoryConditions,
  SynthereumMultiLpLiquidityPoolCreator
{
  //----------------------------------------
  // Storage
  //----------------------------------------

  bytes4 public immutable override deploymentSignature;

  //----------------------------------------
  // Constructor
  //----------------------------------------

  /**
   * @notice Set synthereum finder
   * @param synthereumFinder Synthereum finder contract
   */
  constructor(address synthereumFinder)
    SynthereumMultiLpLiquidityPoolCreator(synthereumFinder)
  {
    deploymentSignature = this.createPool.selector;
  }

  //----------------------------------------
  // Public functions
  //----------------------------------------

  /**
   * @notice Check if the sender is the deployer and deploy a pool
   * @param params input parameters of the pool
   * @return pool Deployed pool
   */
  function createPool(Params calldata params)
    public
    override
    nonReentrant
    returns (ISynthereumMultiLpLiquidityPool pool)
  {
    checkDeploymentConditions(
      synthereumFinder,
      params.collateralToken,
      params.priceIdentifier
    );
    pool = super.createPool(params);
  }
}
