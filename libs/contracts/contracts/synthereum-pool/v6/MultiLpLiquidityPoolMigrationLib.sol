// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity 0.8.9;

import {ISynthereumFinder} from '../../core/interfaces/IFinder.sol';
import {
  ILendingManager
} from '../../lending-module/interfaces/ILendingManager.sol';
import {
  ISynthereumMultiLpLiquidityPool
} from './interfaces/IMultiLpLiquidityPool.sol';
import {
  ISynthereumPoolMigrationStorage
} from '../common/migration/interfaces/IPoolMigrationStorage.sol';
import {
  EnumerableSet
} from '@openzeppelin/contracts/utils/structs/EnumerableSet.sol';
import {SynthereumMultiLpLiquidityPoolLib} from './MultiLpLiquidityPoolLib.sol';

/**
 * @title Multi LP Synthereum pool lib for migration of the storage
 */

library SynthereumMultiLpLiquidityPoolMigrationLib {
  using EnumerableSet for EnumerableSet.AddressSet;

  /**
   * @notice Reset storage to the initial status
   * @param _storageParams Struct containing all storage variables of a pool (See Storage struct)
   * @param _registeredLPsList List of every registered LP
   * @param _activeLPsList List of every active LP
   */
  function cleanStorage(
    ISynthereumMultiLpLiquidityPool.Storage storage _storageParams,
    address[] calldata _registeredLPsList,
    address[] calldata _activeLPsList
  ) external {
    address lp;
    for (uint256 j = 0; j < _activeLPsList.length; j++) {
      lp = _activeLPsList[j];
      _storageParams.activeLPs.remove(lp);
      delete _storageParams.lpPositions[lp];
    }
    for (uint256 j = 0; j < _registeredLPsList.length; j++) {
      _storageParams.registeredLPs.remove(_registeredLPsList[j]);
    }
    delete _storageParams.totalSyntheticAsset;
  }

  /**
   * @notice Set the storage to the new pool during migration
   * @param _storageParams Struct containing all storage variables of a pool (See Storage struct)
   * @param _poolVersion Version of the pool
   * @param _storageBytes Pool storage encoded in bytes
   */
  function setStorage(
    ISynthereumMultiLpLiquidityPool.Storage storage _storageParams,
    uint8 _poolVersion,
    bytes calldata _storageBytes
  ) external {
    _storageParams.poolVersion = _poolVersion;

    ISynthereumPoolMigrationStorage.MigrationV6 memory migrationStorage =
      abi.decode(_storageBytes, (ISynthereumPoolMigrationStorage.MigrationV6));

    _storageParams.lendingModuleId = migrationStorage.lendingModuleId;
    _storageParams.priceIdentifier = migrationStorage.priceIdentifier;
    _storageParams.totalSyntheticAsset = migrationStorage.totalSyntheticAsset;
    _storageParams.collateralAsset = migrationStorage.collateralAsset;
    _storageParams.collateralDecimals = migrationStorage.collateralDecimals;
    _storageParams.overCollateralRequirement = migrationStorage
      .overCollateralRequirement;
    _storageParams.liquidationBonus = migrationStorage.liquidationBonus;
    _storageParams.syntheticAsset = migrationStorage.syntheticAsset;

    address lp;
    for (uint256 j = 0; j < migrationStorage.activeLPsList.length; j++) {
      lp = migrationStorage.activeLPsList[j];
      _storageParams.activeLPs.add(lp);
      _storageParams.lpPositions[lp] = migrationStorage.positions[j];
    }

    for (uint256 j = 0; j < migrationStorage.registeredLPsList.length; j++) {
      _storageParams.registeredLPs.add(migrationStorage.registeredLPsList[j]);
    }
  }

  /**
   * @notice Update storage after the migration splitting fee/bonus of the migration between the LPs
   * @param _storageParams Struct containing all storage variables of a pool (See Storage struct)
   * @param _sourceCollateralAmount Collateral amount from the source pool
   * @param _actualCollateralAmount Collateral amount of the new pool
   * @param _finder Synthereum finder
   */
  function updateMigrationStorage(
    ISynthereumMultiLpLiquidityPool.Storage storage _storageParams,
    uint256 _sourceCollateralAmount,
    uint256 _actualCollateralAmount,
    ISynthereumFinder _finder
  ) external {
    uint256 lpNumbers = _storageParams.activeLPs.length();
    if (lpNumbers > 0) {
      SynthereumMultiLpLiquidityPoolLib.PositionCache[] memory positionsCache =
        new SynthereumMultiLpLiquidityPoolLib.PositionCache[](lpNumbers);
      uint256 totalLpsCollateral =
        SynthereumMultiLpLiquidityPoolLib._loadPositions(
          _storageParams,
          positionsCache
        );
      SynthereumMultiLpLiquidityPoolLib
        ._calculateSwitchingOrMigratingCollateral(
        totalLpsCollateral,
        ILendingManager.MigrateReturnValues(
          _sourceCollateralAmount,
          0,
          _actualCollateralAmount
        ),
        positionsCache
      );
      SynthereumMultiLpLiquidityPoolLib._updateActualLPPositions(
        _storageParams,
        positionsCache
      );
    }
  }

  /**
   * @notice Encode storage of the pool in bytes for migration
   * @param _storageParams Struct containing all storage variables of a pool (See Storage struct)
   * @param _registeredLPsList List of every registered LP
   * @param _activeLPsList List of every active LP
   * @return poolVersion Version of the pool
   * @return storageBytes Encoded pool storage in bytes
   */
  function encodeStorage(
    ISynthereumMultiLpLiquidityPool.Storage storage _storageParams,
    address[] calldata _registeredLPsList,
    address[] calldata _activeLPsList
  ) external view returns (uint8 poolVersion, bytes memory storageBytes) {
    poolVersion = _storageParams.poolVersion;
    uint256 numberOfLps = _activeLPsList.length;
    ISynthereumMultiLpLiquidityPool.LPPosition[] memory positions =
      new ISynthereumMultiLpLiquidityPool.LPPosition[](numberOfLps);
    for (uint256 j = 0; j < numberOfLps; j++) {
      positions[j] = _storageParams.lpPositions[_activeLPsList[j]];
    }
    storageBytes = abi.encode(
      ISynthereumPoolMigrationStorage.MigrationV6(
        _storageParams.lendingModuleId,
        _storageParams.priceIdentifier,
        _storageParams.totalSyntheticAsset,
        _storageParams.collateralAsset,
        _storageParams.collateralDecimals,
        _storageParams.overCollateralRequirement,
        _storageParams.liquidationBonus,
        _storageParams.syntheticAsset,
        _registeredLPsList,
        _activeLPsList,
        positions
      )
    );
  }
}
