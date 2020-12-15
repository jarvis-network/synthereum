// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.6.12;

import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {
  ISynthereumPoolDeployment
} from '../../synthereum-pool/common/interfaces/IPoolDeployment.sol';
import {
  IDerivativeDeployment
} from '../../derivative/common/interfaces/IDerivativeDeployment.sol';
import {EnumerableSet} from '@openzeppelin/contracts/utils/EnumerableSet.sol';

/**
 * @title Provides interface with functions of Synthereum deployer
 */
interface ISynthereumDeployer {
  /**
   * @notice Deploys derivative and pool linking the contracts together
   * @param derivativeVersion Version of derivative contract
   * @param poolVersion Version of the pool contract
   * @param derivativeParamsData Input params of derivative constructor
   * @param poolParamsData Input params of pool constructor
   * @return derivative Derivative contract deployed
   * @return pool Pool contract deployed
   */
  function deployPoolAndDerivative(
    uint8 derivativeVersion,
    uint8 poolVersion,
    bytes calldata derivativeParamsData,
    bytes calldata poolParamsData
  )
    external
    returns (IDerivativeDeployment derivative, ISynthereumPoolDeployment pool);

  /**
   * @notice Deploys pool and links it with an already existing derivative
   * @param poolVersion Version of the pool contract
   * @param poolParamsData Input params of pool constructor
   * @param derivative Existing derivative contract to link with the new pool
   * @return pool Pool contract deployed
   */
  function deployOnlyPool(
    uint8 poolVersion,
    bytes calldata poolParamsData,
    IDerivativeDeployment derivative
  ) external returns (ISynthereumPoolDeployment pool);

  /**
   * @notice Deploys derivative and links it with an already existing pool
   * @param derivativeVersion Version of the derivative contract
   * @param derivativeParamsData Input params of derivative constructor
   * @param pool Existing pool contract to link with the new derivative
   * @return derivative Derivative contract deployed
   */
  function deployOnlyDerivative(
    uint8 derivativeVersion,
    bytes calldata derivativeParamsData,
    ISynthereumPoolDeployment pool
  ) external returns (IDerivativeDeployment derivative);

  /**
   * @notice Returns if a particular pool exists or not
   * @param poolSymbol Synthetic token symbol of the pool
   * @param collateral ERC20 contract of collateral currency
   * @param poolVersion Version of the pool
   * @param pool Contract of the pool to check
   * @return isDeployed Returns true if a particular pool exists, otherwiise false
   */
  function isPoolDeployed(
    string calldata poolSymbol,
    IERC20 collateral,
    uint8 poolVersion,
    ISynthereumPoolDeployment pool
  ) external view returns (bool isDeployed);

  /**
   * @notice Returns all the pools with partcular symbol, collateral and verion
   * @param poolSymbol Synthetic token symbol of the pool
   * @param collateral ERC20 contract of collateral currency
   * @param poolVersion Version of the pool
   * @return List of all pools
   */
  function getPools(
    string calldata poolSymbol,
    IERC20 collateral,
    uint8 poolVersion
  ) external view returns (address[] memory);
}
