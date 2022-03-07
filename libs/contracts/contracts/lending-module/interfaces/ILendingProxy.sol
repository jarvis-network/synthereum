// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity >=0.8.0;

interface ILendingProxy {
  struct Roles {
    address admin;
    address maintainer;
  }

  struct ReturnValues {
    uint256 poolInterest;
    uint256 daoInterest;
    uint256 tokensOut;
    uint256 tokensTransferred;
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
    returns (ReturnValues memory returnValues);

  function executeBuyback(uint256 amount, bytes memory swapParams)
    external
    returns (ReturnValues memory returnValues);

  function setLendingModule(address lendingModule, string memory id) external;

  function setSwapModule(address swapModule, address collateral) external;

  function setLendingArgs(address lendingModule, bytes memory args) external;

  function setPool(
    address pool,
    address collateral,
    string memory lendingID,
    bytes memory lendingArgs,
    address interestBearingToken,
    uint256 daoInterestShare,
    uint256 jrtBuybackShare
  ) external;

  function migrateLendingModule(
    address newLendingModule,
    address newInterestBearingToken,
    uint256 interestTokenAmount
  ) external returns (ReturnValues memory);

  function migrateLiquidity(address newPool) external;

  function getInterestBearingToken(address pool)
    external
    view
    returns (address interestTokenAddr);

  function collateralToInterestToken(
    uint256 collateralAmount,
    bool isExactTransfer
  )
    external
    view
    returns (uint256 interestTokenAmount, address interestTokenAddr);
}
