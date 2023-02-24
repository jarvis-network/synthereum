// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity 0.8.9;

/**
 * @title Provides interface that need to be supported by a public vault during a pool migration
 */
interface IVaultMigration {
  /**
   * @notice Sets an address to be reference pool the vault is using
   * @notice Only vault registry can call this method
   * @param newPool address of the pool
   */
  function setReferencePool(address newPool) external;
}
