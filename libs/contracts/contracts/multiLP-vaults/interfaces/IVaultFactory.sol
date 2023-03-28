// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity 0.8.9;

import {IVault} from './IVault.sol';

/**
 * @title Provides interface for Public vault factory
 */
interface IVaultFactory {
  /**
   * @notice Deploy a public vault
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
  ) external returns (IVault vault);

  /**
   * @notice Encodes the initialise call with its parameters
   * @param encodedParams Abi encoded parameters
   * @return encodedCall Bytes encoding of initialise call
   */
  function encodeInitialiseCall(bytes memory encodedParams)
    external
    view
    returns (bytes memory encodedCall);

  /**
   * @notice Returns the address of deployed vault implementation
   * @return implementation deployed vault implementation
   */
  function vaultImplementation() external view returns (address implementation);
}
