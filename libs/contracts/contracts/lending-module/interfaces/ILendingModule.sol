// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.4;

import {ILendingProxy} from './ILendingProxy.sol';

interface ILendingModule {
  function deposit(ILendingProxy.PoolStorage calldata poolData, uint256 amount)
    external
    returns (
      uint256 tokensOut,
      uint256 poolInterest,
      uint256 daoInterest
    );

  function withdraw(
    ILendingProxy.PoolStorage calldata poolData,
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
