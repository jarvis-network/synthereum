// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.4;

import {ISynthereumFinder} from '../../../core/interfaces/IFinder.sol';
import {
  IDeploymentSignature
} from '../../../core/interfaces/IDeploymentSignature.sol';
import {SynthereumInterfaces} from '../../../core/Constants.sol';
import {SynthereumCreditLineCreator} from './CreditLineCreator.sol';

/** @title Contract factory of self-minting derivatives
 */
contract CreditLineFactory is
  SynthereumCreditLineCreator,
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
   * @notice Constructs the SelfMintingDerivativeFactory contract
   * @param _synthereumFinder Synthereum Finder address used to discover other contracts
   * @param _timerAddress Contract that stores the current time in a testing environment.
   */
  constructor(address _synthereumFinder, address _timerAddress)
    SynthereumCreditLineCreator(_synthereumFinder, _timerAddress)
  {
    deploymentSignature = this.createPerpetual.selector;
  }

  /**
   * @notice Check if the sender is the deployer and deploy a perpetual self-minting derivative
   * @param params input parameters of perpetual self-minting derivative
   * @return derivative Address of the self-minting derivative contract
   */
  function createPerpetual(Params calldata params)
    public
    override
    returns (address derivative)
  {
    address deployer =
      ISynthereumFinder(synthereumFinder).getImplementationAddress(
        SynthereumInterfaces.Deployer
      );
    require(msg.sender == deployer, 'Sender must be Synthereum deployer');
    derivative = super.createPerpetual(params);
  }
}