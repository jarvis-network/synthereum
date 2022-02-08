// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.4;

interface ILendingProxy {
  function deposit(uint256 amount) external returns (uint256 returnTokenAmount);

  function withdraw(uint256 amount)
    external
    returns (uint256 returnTokenAmount);

  function claimCommission(address pool)
    external
    returns (uint256 amountClaimed);
}
