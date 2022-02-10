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
    uint256 unclaimedDaoJRT;
    uint256 unclaimedDaoCommission;
    uint256 JRTBuybackShare;
  }

  struct ReturnValues {
    uint256 poolInterest;
    uint256 daoInterest;
    uint256 tokensOut;
  }

  function deposit(uint256 amount)
    external
    returns (ReturnValues memory returnValues);

  function withdraw(uint256 amount, address recipient)
    external
    returns (ReturnValues memory returnValues);

  function claimCommission(address pool)
    external
    returns (uint256 amountClaimed);

  function executeBuyback(
    address pool,
    address JRTAddress,
    uint256 expiration
  ) external returns (uint256 amountClaimed);
}
