// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;
import {IDerivative} from '../derivative/common/interfaces/IDerivative.sol';
import {ISynthereumFinder} from '../core/interfaces/IFinder.sol';
import {
  ISynthereumPoolOnChainPriceFeed
} from '../synthereum-pool/v4/interfaces/IPoolOnChainPriceFeed.sol';
import {
  SynthereumPoolOnChainPriceFeed
} from '../synthereum-pool/v4/PoolOnChainPriceFeed.sol';
import {SynthereumInterfaces} from '../core/Constants.sol';
import {
  IDeploymentSignature
} from '../core/interfaces/IDeploymentSignature.sol';
import {
  SynthereumPoolOnChainPriceFeedCreator
} from '../synthereum-pool/v4/PoolOnChainPriceFeedCreator.sol';

contract PoolFactoryMock is
  SynthereumPoolOnChainPriceFeedCreator,
  IDeploymentSignature
{
  address public synthereumFinder;

  bytes4 public override deploymentSignature;

  IDerivative mockDerivative;

  constructor(address _synthereumFinder, IDerivative _mockDerivative) public {
    synthereumFinder = _synthereumFinder;
    deploymentSignature = this.createPool.selector;
    mockDerivative = _mockDerivative;
  }

  function createPool(
    IDerivative derivative,
    ISynthereumFinder finder,
    uint8 version,
    ISynthereumPoolOnChainPriceFeed.Roles memory roles,
    uint256 startingCollateralization,
    ISynthereumPoolOnChainPriceFeed.Fee memory fee
  ) public override returns (SynthereumPoolOnChainPriceFeed poolDeployed) {
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
      startingCollateralization,
      fee
    );
  }
}
