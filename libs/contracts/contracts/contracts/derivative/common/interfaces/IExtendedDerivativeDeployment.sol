// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.6.12;

import {IDerivativeDeployment} from './IDerivativeDeployment.sol';

interface IExtendedDerivativeDeployment is IDerivativeDeployment {
  /**
   * @notice Add admin to DEFAULT_ADMIN_ROLE
   * @param admin address of the Admin.
   */
  function addAdmin(address admin) external;

  /**
   * @notice Add TokenSponsor to POOL_ROLE
   * @param pool address of the TokenSponsor pool.
   */
  function addPool(address pool) external;

  /**
   * @notice Admin renounce to DEFAULT_ADMIN_ROLE
   */
  function renounceAdmin() external;

  /**
   * @notice TokenSponsor pool renounce to POOL_ROLE
   */
  function renouncePool() external;

  /**
   * @notice Add admin and pool to DEFAULT_ADMIN_ROLE and POOL_ROLE
   * @param adminAndPool address of admin/pool.
   */
  function addAdminAndPool(address adminAndPool) external;

  /**
   * @notice Admin and TokenSponsor pool renounce to DEFAULT_ADMIN_ROLE and POOL_ROLE
   */
  function renounceAdminAndPool() external;

  /**
   * @notice Add derivative as minter of synthetic token
   * @param derivative address of the derivative
   */
  function addSyntheticTokenMinter(address derivative) external;

  /**
   * @notice Add derivative as burner of synthetic token
   * @param derivative address of the derivative
   */
  function addSyntheticTokenBurner(address derivative) external;

  /**
   * @notice Add derivative as admin of synthetic token
   * @param derivative address of the derivative
   */
  function addSyntheticTokenAdmin(address derivative) external;

  /**
   * @notice Add derivative as admin, minter and burner of synthetic token
   * @param derivative address of the derivative
   */
  function addSyntheticTokenAdminAndMinterAndBurner(address derivative)
    external;

  /**
   * @notice This contract renounce to be minter of synthetic token
   */
  function renounceSyntheticTokenMinter() external;

  /**
   * @notice This contract renounce to be burner of synthetic token
   */
  function renounceSyntheticTokenBurner() external;

  /**
   * @notice This contract renounce to be admin of synthetic token
   */
  function renounceSyntheticTokenAdmin() external;

  /**
   * @notice This contract renounce to be admin, minter and burner of synthetic token
   */
  function renounceSyntheticTokenAdminAndMinterAndBurner() external;
}
