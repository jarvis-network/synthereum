// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;
import {
  IExtendedDerivative
} from '../derivative/common/interfaces/IExtendedDerivative.sol';
import {ISynthereumFinder} from '../core/interfaces/IFinder.sol';
import {ISynthereumPool} from '../synthereum-pool/v2/interfaces/IPool.sol';
import {SynthereumPool} from '../synthereum-pool/v2/Pool.sol';
import {SynthereumInterfaces} from '../core/Constants.sol';
import {
  IDeploymentSignature
} from '../core/interfaces/IDeploymentSignature.sol';
import {SynthereumPoolCreator} from '../synthereum-pool/v2/PoolCreator.sol';

contract PoolFactoryMock is SynthereumPoolCreator, IDeploymentSignature {
  address public synthereumFinder;

  bytes4 public override deploymentSignature;

  IExtendedDerivative mockDerivative;

  constructor(address _synthereumFinder, IExtendedDerivative _mockDerivative)
    public
  {
    synthereumFinder = _synthereumFinder;
    deploymentSignature = this.createPool.selector;
    mockDerivative = _mockDerivative;
  }

  function createPool(
    IExtendedDerivative derivative,
    ISynthereumFinder finder,
    uint8 version,
    ISynthereumPool.Roles memory roles,
    bool isContractAllowed,
    uint256 startingCollateralization,
    ISynthereumPool.Fee memory fee
  ) public override returns (SynthereumPool poolDeployed) {
    address deployer =
      ISynthereumFinder(synthereumFinder).getImplementationAddress(
        SynthereumInterfaces.Deployer
      );
    require(msg.sender == deployer, 'Sender must be Synthereum deployer');
    poolDeployed = super.createPool(
      mockDerivative,
      finder,
      version,
      roles,
      isContractAllowed,
      startingCollateralization,
      fee
    );
  }
}
