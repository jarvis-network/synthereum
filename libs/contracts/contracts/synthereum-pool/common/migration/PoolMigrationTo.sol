// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity 0.8.9;

import {ISynthereumFinder} from '../../../core/interfaces/IFinder.sol';
import {SynthereumPoolMigration} from './PoolMigration.sol';

/**
 * @title Abstract contract inherit by pools for moving storage from one pool to another
 */
abstract contract SynthereumPoolMigrationTo is SynthereumPoolMigration {
  /**
   * @notice Migrate storage to this new pool and initialize it
   * @notice This can be called only by a pool factory
   * @param _finder Synthereum finder of the pool
   * @param _poolVersion Version of the pool
   * @param _storageBytes Pool storage encoded in bytes
   * @param _sourceCollateralAmount Collateral amount from the source pool
   * @param _actualCollateralAmount Collateral amount of the new pool   */
  function setMigratedStorage(
    ISynthereumFinder _finder,
    uint8 _poolVersion,
    bytes calldata _storageBytes,
    uint256 _sourceCollateralAmount,
    uint256 _actualCollateralAmount
  ) external onlyPoolFactory {
    finder = _finder;
    _setStorage(_poolVersion, _storageBytes);
    _modifyStorageTo(_sourceCollateralAmount, _actualCollateralAmount);
  }

  /**
   * @notice Function to implement for setting the storage to the new pool
   * @param _poolVersion Version of the pool
   * @param _storageBytes Pool storage encoded in bytes
   */
  function _setStorage(uint8 _poolVersion, bytes calldata _storageBytes)
    internal
    virtual;

  /**
   * @notice Function to implement for modifying the storage of the new pool after the migration
   * @param _sourceCollateralAmount Collateral amount from the source pool
   * @param _actualCollateralAmount Collateral amount of the new pool
   */
  function _modifyStorageTo(
    uint256 _sourceCollateralAmount,
    uint256 _actualCollateralAmount
  ) internal virtual;
}
