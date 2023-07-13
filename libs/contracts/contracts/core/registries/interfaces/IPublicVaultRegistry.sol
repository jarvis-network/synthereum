// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity >=0.8.0;

/**
 * @title Interface of PublicVaultRegistry
 */

interface IPublicVaultRegistry {
  /**
   * @notice Allow the deployer to map a vault to a pool
   * @param pool Address of the pool
   * @param vault Address of the vault
   */
  function registerVault(address pool, address vault) external;

  /**
   * @notice To unregister a vault
   * @notice Only a registered pool can call this one to remove its own registered vaults
   * @param vault Address of the vault to unregister
   */
  function removeVault(address vault) external;

  /**
   * @notice Allow to move vaults from an old pool to a new pool
   * @notice Only deployer can call this function
   * @param oldPool Address of the old pool
   * @param newPool Address of the new pool
   */
  function migrateVaults(address oldPool, address newPool) external;

  /**
   * @notice Returns all the vaults associated to a pool
   * @param pool Pool address
   * @return List of all vaults registered to the pool
   */
  function getVaults(address pool) external view returns (address[] memory);

  /**
   * @notice Checks if an address is a registered vault
   * @param vault Vault address
   * @return Boolean
   */
  function isVaultSupported(address vault) external view returns (bool);
}
