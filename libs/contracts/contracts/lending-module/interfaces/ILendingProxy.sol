// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity >=0.8.0;

interface ILendingProxy {
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

  function claimCommission(uint256 amount)
    external
    returns (uint256 amountClaimed);

  function executeBuyback(uint256 amount, bytes memory swapParams)
    external
    returns (uint256 amountOut);

  function setLendingModule(address lendingModule, string memory id) external;

  function setPool(
    address pool,
    address collateral,
    string memory lendingID,
    address interestBearingToken,
    uint256 daoInterestShare,
    uint256 jrtBuybackShare
  ) external;

  function migrateLendingModule(
    address newLendingModule,
    address newInterestBearingToken
  ) external;

  function migrateLiquidity(address newPool) external;

  function getInterestBearingToken(address pool)
    external
    view
    returns (address interestTokenAddr);

  function collateralToInterestToken(uint256 collateralAmount)
    external
    view
    returns (uint256 interestBearingTokenAmount, address interestTokenAddr);
}
