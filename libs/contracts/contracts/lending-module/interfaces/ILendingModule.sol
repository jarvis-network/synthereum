// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity >=0.8.0;

import {ILendingStorageManager} from './ILendingStorageManager.sol';

interface ILendingModule {
  function deposit(
    ILendingStorageManager.PoolStorage calldata poolData,
    ILendingStorageManager storageManager,
    uint256 amount
  )
    external
    returns (
      uint256 poolInterest,
      uint256 daoInterest,
      uint256 tokensOut,
      uint256 tokensTransferred
    );

  function withdraw(
    ILendingStorageManager.PoolStorage calldata poolData,
    ILendingStorageManager storageManager,
    uint256 amount,
    address recipient
  )
    external
    returns (
      uint256 poolInterest,
      uint256 daoInterest,
      uint256 tokensOut,
      uint256 tokensTransferred
    );

  function getAccumulatedInterest(
    address poolAddress,
    ILendingStorageManager.PoolStorage calldata poolData
  ) external view returns (uint256 poolInterest, uint256 daoInterest);

  function getInterestBearingToken(
    address collateral,
    address storageManager,
    address lendingModule
  ) external returns (address token);

  function collateralToInterestToken(
    uint256 collateralAmount,
    address collateral,
    address interestToken,
    bytes memory extraArgs,
    bool isExactTransfer
  ) external view returns (uint256 interestTokenAmount);
}
