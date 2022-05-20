// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity 0.8.9;

import {ISynthereumFinder} from '../../../core/interfaces/IFinder.sol';
import {SynthereumPoolMigration} from './PoolMigration.sol';

/**
 * @title Abstract contract inherit by pools for moving storage from one pool to another
 */
abstract contract SynthereumPoolMigrationFrom is SynthereumPoolMigration {
  /**
   * @notice Migrate storage from this pool resetting and cleaning data
   * @notice This can be called only by a pool factory
   * @return synthFinder Synthereum finder of the pool
   * @return poolVersion Version of the pool
   * @return storageBytes Pool storage encoded in bytes
   */
  function migrateStorage()
    external
    onlyPoolFactory
    returns (
      ISynthereumFinder synthFinder,
      uint8 poolVersion,
      bytes memory storageBytes
    )
  {
    _modifyStorageFrom();
    synthFinder = finder;
    (poolVersion, storageBytes) = _encodeStorage();
    _cleanStorage();
  }

  /**
   * @notice Function to implement for modifying storage before the encoding
   */
  function _modifyStorageFrom() internal virtual;

  /**
   * @notice Function to implement for cleaning and resetting the storage to the initial state
   */
  function _cleanStorage() internal virtual;

  /**
   * @notice Function to implement for encoding storage in bytes
   * @return poolVersion Version of the pool
   * @return storageBytes Pool storage encoded in bytes
   */
  function _encodeStorage()
    internal
    view
    virtual
    returns (uint8 poolVersion, bytes memory storageBytes);
}
