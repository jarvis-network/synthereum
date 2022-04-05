// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity 0.8.9;

interface IVault {
  event Deposit(uint256 netCollateralDeposited, uint256 lpTokensOut);

  function deposit(uint256 collateralAmount)
    external
    returns (uint256 lpTokensOut);

  function withdraw(uint256 LPTokensAmount)
    external
    returns (uint256 collateralOut);
}
