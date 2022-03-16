// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity >=0.8.0;

import {ILendingStorageManager} from './ILendingStorageManager.sol';

interface ILendingModule {
  struct ReturnValues {
    uint256 totalInterest;
    uint256 tokensOut;
    uint256 tokensTransferred;
  }

  function deposit(
    ILendingStorageManager.PoolStorage calldata poolData,
    bytes memory lendingArgs,
    uint256 amount,
    address recipient
  )
    external
    returns (
      uint256 totalInterest,
      uint256 tokensOut,
      uint256 tokensTransferred
    );

  function withdraw(
    ILendingStorageManager.PoolStorage calldata poolData,
    address pool,
    bytes memory lendingArgs,
    uint256 amount,
    address recipient
  )
    external
    returns (
      uint256 totalInterest,
      uint256 tokensOut,
      uint256 tokensTransferred
    );

  function getAccumulatedInterest(
    address poolAddress,
    ILendingStorageManager.PoolStorage calldata poolData
  ) external view returns (uint256 totalInterest);

  function getInterestBearingToken(address collateral, bytes memory args)
    external
    returns (address token);

  function collateralToInterestToken(
    uint256 collateralAmount,
    address collateral,
    address interestToken,
    bytes memory extraArgs,
    bool isExactTransfer
  ) external view returns (uint256 interestTokenAmount);
}
