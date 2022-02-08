// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.4;

interface ILendingModule {
  function deposit(uint256 amount) external;

  function withdraw(uint256 amount) external;

  function claimCommission(address pool)
    external
    returns (uint256 amountClaimed);
}
