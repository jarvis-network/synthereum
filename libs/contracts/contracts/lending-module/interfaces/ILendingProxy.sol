// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.4;

interface ILendingProxy {
  struct PoolStorage {
    address moneyMarket;
    address lendingModule;
    address interestBearingToken;
    address swapRouter;
    uint256 collateralDeposited;
    uint256 daoInterestShare;
    uint256 unclaimedDaoInterest;
    uint256 JRTBuybackShare;
  }

  function deposit(uint256 amount) external returns (uint256 poolInterest);

  function withdraw(uint256 amount, address recipient)
    external
    returns (uint256 poolInterest);

  function claimCommission(address pool)
    external
    returns (uint256 amountClaimed);

  function executeBuyback(
    address pool,
    address JRTAddress,
    uint256 expiration
  ) external returns (uint256 amountClaimed);
}
