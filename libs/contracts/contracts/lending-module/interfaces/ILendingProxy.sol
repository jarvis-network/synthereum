// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.4;

interface ILendingProxy {
  struct PoolStorage {
    address moneyMarket;
    address lendingModule;
    address jrtSwapModule;
    address interestBearingToken;
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

  event PoolRegistered(
    address pool,
    address moneyMarket,
    address lendingModule,
    address jrtSwapModule,
    address interestBearingToken
  );
  event Deposit(address pool, uint256 amount);
  event Withdraw(address pool, uint256 amount, address recipient);

  function deposit(uint256 amount)
    external
    returns (ReturnValues memory returnValues);

  function withdraw(uint256 amount, address recipient)
    external
    returns (ReturnValues memory returnValues);

  function claimCommission() external returns (uint256 amountClaimed);

  function executeBuyback(bytes memory swapParams)
    external
    returns (uint256 amountOut);

  function setPool(
    address pool,
    address moneyMarket,
    address lendingModule,
    address jrtSwapModule,
    address interestBearingToken
  ) external;
}
