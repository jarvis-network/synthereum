// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity 0.8.9;

import {IVault} from './interfaces/IVault.sol';
import {IVaultFactory} from './interfaces/IVaultFactory.sol';
import {
  IDeploymentSignature
} from '../core/interfaces/IDeploymentSignature.sol';
import {
  ReentrancyGuard
} from '@openzeppelin/contracts/security/ReentrancyGuard.sol';
import {FactoryConditions} from '../common/FactoryConditions.sol';
import {SynthereumMultiLPVaultCreator} from './VaultCreator.sol';

contract SynthereumMultiLPVaultFactory is
  IVaultFactory,
  IDeploymentSignature,
  ReentrancyGuard,
  FactoryConditions,
  SynthereumMultiLPVaultCreator
{
  bytes4 public immutable override deploymentSignature;

  /**
   * @param _synthereumFinder Address of the synthereum finder
   * @param _vaultImplementation Address of the deployed vault implementation used for EIP1167
   */
  constructor(address _synthereumFinder, address _vaultImplementation)
    SynthereumMultiLPVaultCreator(_synthereumFinder, _vaultImplementation)
  {
    deploymentSignature = this.createVault.selector;
  }

  /**
   * @notice Check if the sender is the deployer and deploy a vault
   * @param _lpTokenName name of the LP token representing a share in the vault
   * @param _lpTokenSymbol symbol of the LP token representing a share in the vault
   * @param _pool address of MultiLP pool the vault interacts with
   * @param _overCollateralization over collateral requirement of the vault position in the pool
   * @return vault Deployed vault
   */
  function createVault(
    string memory _lpTokenName,
    string memory _lpTokenSymbol,
    address _pool,
    uint128 _overCollateralization
  )
    public
    override(IVaultFactory, SynthereumMultiLPVaultCreator)
    onlyDeployer(synthereumFinder)
    nonReentrant
    returns (IVault vault)
  {
    vault = super.createVault(
      _lpTokenName,
      _lpTokenSymbol,
      _pool,
      _overCollateralization
    );
  }

  /**
   * @notice ABI Encodes vault initialise method to construct a vault during deployment
   * @param encodedParams ABI encoded parameters for constructor
   * @return encodedCall Encoded function call with parameters
   */
  function encodeInitialiseCall(bytes memory encodedParams)
    public
    override(IVaultFactory, SynthereumMultiLPVaultCreator)
    returns (bytes memory encodedCall)
  {
    encodedCall = super.encodeInitialiseCall(encodedParams);
  }

  /**
   * @notice Returns address of deployed vault implementation the factory is using
   * @return implementation Vault implementation
   */
  function vaultImplementation()
    public
    override(IVaultFactory, SynthereumMultiLPVaultCreator)
    returns (address implementation)
  {
    implementation = super.vaultImplementation();
  }
}
