// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity 0.8.9;

interface IVault {
  event Deposit(uint256 netCollateralDeposited, uint256 lpTokensOut);

  event Withdraw(uint256 lpTokensBurned, uint256 netCollateralOut);

  function deposit(uint256 collateralAmount)
    external
    returns (uint256 lpTokensOut);

  function withdraw(uint256 lpTokensAmount)
    external
    returns (uint256 collateralOut);
}
