// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.4;

import {IPoolStorageManager} from './IPoolStorageManager.sol';

interface ILendingModule {
  function deposit(
    IPoolStorageManager.PoolStorage calldata poolData,
    IPoolStorageManager storageManager,
    uint256 amount
  )
    external
    returns (
      uint256 tokensOut,
      uint256 poolInterest,
      uint256 daoInterest
    );

  function withdraw(
    IPoolStorageManager.PoolStorage calldata poolData,
    IPoolStorageManager storageManager,
    uint256 amount,
    address recipient
  )
    external
    returns (
      uint256 tokensOut,
      uint256 poolInterest,
      uint256 daoInterest
    );
}
