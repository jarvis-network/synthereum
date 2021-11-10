// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.4;

import {IStandardERC20} from '../../base/interfaces/IStandardERC20.sol';
import {
  IMintableBurnableERC20
} from '../../tokens/interfaces/IMintableBurnableERC20.sol';
import {ISynthereumFinder} from '../../core/interfaces/IFinder.sol';
import {
  ISynthereumLiquidityPoolStorage
} from './interfaces/ILiquidityPoolStorage.sol';
import {
  IDeploymentSignature
} from '../../core/interfaces/IDeploymentSignature.sol';
import {SynthereumInterfaces} from '../../core/Constants.sol';
import {SynthereumLiquidityPoolCreator} from './LiquidityPoolCreator.sol';
import {SynthereumLiquidityPool} from './LiquidityPool.sol';
import {Lockable} from '@uma/core/contracts/common/implementation/Lockable.sol';

contract SynthereumLiquidityPoolFactory is
  Lockable,
  SynthereumLiquidityPoolCreator,
  IDeploymentSignature
{
  //----------------------------------------
  // Storage
  //----------------------------------------

  bytes4 public override deploymentSignature;

  //----------------------------------------
  // Constructor
  //----------------------------------------

  /**
   * @notice Set synthereum finder
   * @param synthereumFinder Synthereum finder contract
   */
  constructor(address synthereumFinder)
    SynthereumLiquidityPoolCreator(synthereumFinder)
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
    returns (SynthereumLiquidityPool pool)
  {
    address deployer =
      ISynthereumFinder(synthereumFinder).getImplementationAddress(
        SynthereumInterfaces.Deployer
      );
    require(msg.sender == deployer, 'Sender must be Synthereum deployer');
    pool = super.createPool(params);
  }
}
