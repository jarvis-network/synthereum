// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity 0.8.9;

import {ISynthereumFinder} from '../interfaces/IFinder.sol';
import {IVaultMigration} from '../../multiLP-vaults/interfaces/IVaultMigration.sol';
import {IPublicVaultRegistry} from './interfaces/IPublicVaultRegistry.sol';
import {SynthereumInterfaces} from '../Constants.sol';
import {EnumerableSet} from '@openzeppelin/contracts/utils/structs/EnumerableSet.sol';
import {ReentrancyGuard} from '@openzeppelin/contracts/security/ReentrancyGuard.sol';

/**
 * @title Register and track all the vaults deployed and pool links
 */
contract SynthereumPublicVaultRegistry is
  IPublicVaultRegistry,
  ReentrancyGuard
{
  using EnumerableSet for EnumerableSet.AddressSet;

  ISynthereumFinder public immutable synthereumFinder;

  mapping(address => bool) private isVault;
  mapping(address => EnumerableSet.AddressSet) private poolToVaults;

  /**
   * @notice Check if the sender is the deployer
   */
  modifier onlyDeployer() {
    address deployer = synthereumFinder.getImplementationAddress(
      SynthereumInterfaces.Deployer
    );
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
    override
    onlyDeployer
    nonReentrant
  {
    require(poolToVaults[pool].add(vault), 'Vault already registered');
    isVault[vault] = true;
  }

  /**
   * @notice Allow to move vaults from an old pool to a new pol migrated
   * @notice Only deployer can call this function
   * @param oldPool Address of the old pool
   * @param newPool Address of the new pool
   */
  function migrateVaults(address oldPool, address newPool)
    external
    override
    onlyDeployer
    nonReentrant
  {
    EnumerableSet.AddressSet storage vaultSet = poolToVaults[oldPool];
    EnumerableSet.AddressSet storage newVaultSet = poolToVaults[newPool];
    address[] memory poolVaults = vaultSet.values();
    for (uint256 j = 0; j < poolVaults.length; j++) {
      vaultSet.remove(poolVaults[j]);
      require(newVaultSet.add(poolVaults[j]), 'Vault already registered');
      IVaultMigration(poolVaults[j]).setReferencePool(newPool);
    }
  }

  /**
   * @notice Allow the deployer to unregister a vault
   * @notice Only a registered pool can call this one to remove his own registered vaults
   * @param vault Address of the vault to unregister
   */
  function removeVault(address vault) external override nonReentrant {
    require(poolToVaults[msg.sender].remove(vault), 'Vault not registered');
    isVault[vault] = false;
  }

  /**
   * @notice Returns all the vaults associated to a pool
   * @param pool Pool address
   * @return List of all vaults registered to the pool
   */
  function getVaults(address pool)
    external
    view
    override
    returns (address[] memory)
  {
    return poolToVaults[pool].values();
  }

  /**
   * @notice Checks if an address is a registered vault
   * @param vault Vault address
   * @return Boolean
   */
  function isVaultSupported(address vault)
    external
    view
    override
    returns (bool)
  {
    return isVault[vault];
  }
}
