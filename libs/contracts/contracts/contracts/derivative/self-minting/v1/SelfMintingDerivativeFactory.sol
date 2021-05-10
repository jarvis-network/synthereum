// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import {ISynthereumFinder} from '../../../core/interfaces/IFinder.sol';
import {
  IDeploymentSignature
} from '../../../core/interfaces/IDeploymentSignature.sol';
import {SynthereumInterfaces} from '../../../core/Constants.sol';
import {
  SelfMintingPerpetutalMultiPartyCreator
} from './SelfMintingPerpetutalMultiPartyCreator.sol';

contract SelfMintingDerivativeFactory is
  SelfMintingPerpetutalMultiPartyCreator,
  IDeploymentSignature
{
  bytes4 public override deploymentSignature;

  constructor(
    address _umaFinder,
    address _synthereumFinder,
    address _timerAddress
  )
    public
    SelfMintingPerpetutalMultiPartyCreator(
      _umaFinder,
      _synthereumFinder,
      _timerAddress
    )
  {
    deploymentSignature = this.createPerpetual.selector;
  }

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
