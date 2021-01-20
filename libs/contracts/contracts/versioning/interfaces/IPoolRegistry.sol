// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.6.12;

import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';

/**
 * @title Provides interface with functions of SynthereumPoolRegistry
 */
interface ISynthereumPoolRegistry {
  /**
   * @notice Allow the deployer to register a pool just deployed
   * @param syntheticTokenSymbol Symbol of the syntheticToken
   * @param collateralToken Collateral ERC20 token of the pool deployed
   * @param poolVersion Version of the pool deployed
   * @param pool Address of the pool deployed
   */
  function registerPool(
    string calldata syntheticTokenSymbol,
    IERC20 collateralToken,
    uint8 poolVersion,
    address pool
  ) external;

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
    address pool
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

  /**
   * @notice Returns all the collateral used
   * @return List of all collaterals
   */
  function getCollaterals() external view returns (address[] memory);
}
