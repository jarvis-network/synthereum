// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;
import {
  IDeploymentSignature
} from '../../versioning/interfaces/IDeploymentSignature.sol';
import {ISynthereumFinder} from '../../versioning/interfaces/IFinder.sol';
import {SynthereumInterfaces} from '../../versioning/Constants.sol';
import {
  PerpetualPoolPartyCreator
} from '@jarvis-network/uma-core/contracts/financial-templates/perpetual-poolParty/PerpetutalPoolPartyCreator.sol';

contract SynthereumDerivativeFactory is
  PerpetualPoolPartyCreator,
  IDeploymentSignature
{
  //----------------------------------------
  // State variables
  //----------------------------------------

  address public synthereumFinder;

  bytes4 public override deploymentSignature;

  //----------------------------------------
  // Constructor
  //----------------------------------------

  /**
   * @notice Constructs the SynthereumDerivativeFactory contract
   * @param _synthereumFinder Synthereum finder contract
   * @param _umaFinder Finder of UMA DVM protocol
   * @param _tokenFactoryAddress Address of synthetic token factory
   * @param _tokenFactoryAddress Address of UMA Timer contract
   */
  constructor(
    address _synthereumFinder,
    address _umaFinder,
    address _tokenFactoryAddress,
    address _timerAddress
  )
    public
    PerpetualPoolPartyCreator(_umaFinder, _tokenFactoryAddress, _timerAddress)
  {
    synthereumFinder = _synthereumFinder;
    deploymentSignature = this.createPerpetual.selector;
  }

  /**
   * @notice Check if the sender is the deployer and deploy a perpetual derivative
   * @param params input parameters of perpetual derivative
   * @return derivative address of the derivative created
   */
  function createPerpetual(Params memory params)
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
