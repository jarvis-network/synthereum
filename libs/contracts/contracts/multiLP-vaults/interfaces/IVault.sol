// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity 0.8.9;

interface IVault {
  event Deposit(
    uint256 netCollateralDeposited,
    uint256 lpTokensOut,
    uint256 rate,
    uint256 discountedRate
  );

  event Withdraw(
    uint256 lpTokensBurned,
    uint256 netCollateralOut,
    uint256 rate
  );

  function deposit(uint256 collateralAmount)
    external
    returns (uint256 lpTokensOut);

  function withdraw(uint256 lpTokensAmount)
    external
    returns (uint256 collateralOut);

  function getRate()
    external
    view
    returns (
      uint256 rate,
      uint256 discountedRate,
      uint256 maxCollateralAtDiscount
    );
}
