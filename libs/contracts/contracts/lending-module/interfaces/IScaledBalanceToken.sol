// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity >=0.8.0;

interface IScaledBalanceToken {
  /**
   * @notice Returns the scaled balance of the user.
   * @dev The scaled balance is the sum of all the updated stored balance divided by the reserve's liquidity index
   * at the moment of the update
   * @param user The user whose balance is calculated
   * @return The scaled balance of the user
   **/
  function scaledBalanceOf(address user) external view returns (uint256);
}