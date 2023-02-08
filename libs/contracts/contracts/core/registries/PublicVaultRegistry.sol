// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity 0.8.9;

import {ISynthereumFinder} from '../interfaces/IFinder.sol';
import {SynthereumInterfaces} from '../Constants.sol';
import {
  ReentrancyGuard
} from '@openzeppelin/contracts/security/ReentrancyGuard.sol';
import {
  EnumerableSet
} from '@openzeppelin/contracts/utils/structs/EnumerableSet.sol';

/**
 * @title Register and track all the vaults deployed and pool links
 */
contract SynthereumPublicVaultRegistry is ReentrancyGuard {
  using EnumerableSet for EnumerableSet.AddressSet;

  ISynthereumFinder public immutable synthereumFinder;

  mapping(address => bool) public isVault;
  mapping(address => EnumerableSet.AddressSet) public poolToVaults;

  /**
   * @notice Check if the sender is the deployer
   */
  modifier onlyDeployer() {
    address deployer =
      synthereumFinder.getImplementationAddress(SynthereumInterfaces.Deployer);
    require(msg.sender == deployer, 'Sender must be Synthereum deployer');
    _;
  }

  constructor(ISynthereumFinder _synthereumFinder) {
    synthereumFinder = _synthereumFinder;
  }

  /**
   * @notice Allow the deployer to map a vault to a pool
   * @param pool Address of the pool
   * @param vault Address of the vault
   */
  function registerVault(address pool, address vault)
    external
    onlyDeployer
    nonReentrant
  {
    require(poolToVaults[pool].add(vault), 'Vault already registered');
    isVault[vault] = true;
  }

  /**
   * @notice Allow the deployer to unregister a vault
   * @param pool Address of the pool
   * @param vault Address of the vault to unregister
   */
  function removeVault(address pool, address vault)
    external
    onlyDeployer
    nonReentrant
  {
    require(poolToVaults[pool].remove(vault), 'Vault not registered');
    isVault[vault] = false;
  }
}
