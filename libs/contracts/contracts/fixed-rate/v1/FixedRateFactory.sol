// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.4;

import {ISynthereumFinder} from '../../core/interfaces/IFinder.sol';
import {
  IDeploymentSignature
} from '../../core/interfaces/IDeploymentSignature.sol';
import {SynthereumInterfaces} from '../../core/Constants.sol';
import {SynthereumFixedRateCreator} from './FixedRateCreator.sol';
import {SynthereumFixedRateWrapper} from './FixedRateWrapper.sol';
import {FactoryConditions} from '../../common/FactoryConditions.sol';
import {
  ReentrancyGuard
} from '@openzeppelin/contracts/security/ReentrancyGuard.sol';

contract SynthereumFixedRateFactory is
  IDeploymentSignature,
  ReentrancyGuard,
  FactoryConditions,
  SynthereumFixedRateCreator
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
    SynthereumFixedRateCreator(synthereumFinder)
  {
    deploymentSignature = this.createFixedRate.selector;
  }

  //----------------------------------------
  // Public functions
  //----------------------------------------

  /**
   * @notice Check if the sender is the deployer and deploy a fixed rate
   * @param params input parameters of the fixed rate
   * @return fixedRate Deployed fixed rate
   */
  function createFixedRate(Params calldata params)
    public
    override
    nonReentrant
    returns (SynthereumFixedRateWrapper fixedRate)
  {
    address deployer =
      synthereumFinder.getImplementationAddress(SynthereumInterfaces.Deployer);
    require(msg.sender == deployer, 'Sender must be Synthereum deployer');
    fixedRate = super.createFixedRate(params);
  }
}
