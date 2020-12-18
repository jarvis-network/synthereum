// SPDX-License-Identifier
pragma solidity ^0.6.12;

import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';

/**
 * @title Interface that a derivative MUST have in order to be included in the deployer
 */
interface IDerivativeDeployment {
  /**
   * @notice Add admin and pool to DEFAULT_ADMIN_ROLE and POOL_ROLE
   * @param adminAndPool address of admin/pool.
   */
  function addAdminAndPool(address adminAndPool) external;

  /**
   * @notice Admin renounce to DEFAULT_ADMIN_ROLE
   */
  function renounceAdmin() external;

  /**
   * @notice Gets the collateral currency of the derivative
   * @return collateral Collateral currency
   */
  function collateralCurrency() external view returns (IERC20 collateral);

  /**
   * @notice Get emergency shutdown price
   * @return syntheticCurrency Synthetic token
   */
  function tokenCurrency() external view returns (IERC20 syntheticCurrency);

  /**
   * @notice Accessor method for the list of members with admin role
   * @return array of addresses with admin role
   */

  function getAdminMembers() external view returns (address[] memory);

  /**
   * @notice Accessor method for the list of members with pool role
   * @return array of addresses with pool role
   */

  function getPoolMembers() external view returns (address[] memory);
}
