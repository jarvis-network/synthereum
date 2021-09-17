// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.4;

import {ERC20} from '@openzeppelin/contracts/token/ERC20/ERC20.sol';
import {IMintableBurnableERC20} from './IMintableBurnableERC20.sol';

/**
 * @title ERC20 interface that includes burn mint and roles methods.
 */
abstract contract BaseControlledMintableBurnableERC20 is
  ERC20,
  IMintableBurnableERC20
{
  /**
   * @notice Add Minter role to an account
   * @param account Address to which Minter role will be added
   */
  function addMinter(address account) external virtual;

  /**
   * @notice Add Burner role to an account
   * @param account Address to which Burner role will be added
   */
  function addBurner(address account) external virtual;

  /**
   * @notice Add Admin role to an account
   * @param account Address to which Admin role will be added
   */
  function addAdmin(address account) external virtual;

  /**
   * @notice Add Admin, Minter and Burner roles to an account
   * @param account Address to which Admin, Minter and Burner roles will be added
   */
  function addAdminAndMinterAndBurner(address account) external virtual;

  /**
   * @notice Add Admin, Minter and Burner roles to an account
   * @param account Address to which Admin, Minter and Burner roles will be added
   */
  /**
   * @notice Self renounce the address calling the function from minter role
   */
  function renounceMinter() external virtual;

  /**
   * @notice Self renounce the address calling the function from burner role
   */
  function renounceBurner() external virtual;

  /**
   * @notice Self renounce the address calling the function from admin role
   */
  function renounceAdmin() external virtual;

  /**
   * @notice Self renounce the address calling the function from admin, minter and burner role
   */
  function renounceAdminAndMinterAndBurner() external virtual;
}
