// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.10;

import {ILendingProxy} from '../interfaces/ILendingProxy.sol';
import {IPool} from '@aave/core-v3/contracts/interfaces/IPool.sol';
import {
  IScaledBalanceToken
} from '@aave/core-v3/contracts/interfaces/IScaledBalanceToken.sol';
import {
  ISynthereumFinder
} from '@jarvis-network/synthereum-contracts/contracts/core/interfaces/IFinder.sol';
import {
  ISynthereumDeployment
} from '@jarvis-network/synthereum-contracts/contracts/common/interfaces/IDeployment.sol';
import {Address} from '@openzeppelin/contracts/utils/Address.sol';
import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {
  SafeERC20
} from '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';

contract AaveV3Module {
  function deposit(ILendingProxy.PoolStorage poolData, uint256 amount)
    external
    returns (
      uint256 tokensOut,
      uint256 poolInterest,
      uint256 daoInterest
    )
  {
    // retrievve pool collateral
    IERC20 collateral = ISynthereumDeployment(msg.sender).collateralToken();
    collateral.safeTransferFrom(msg.sender, address(this), amount);

    // aave deposit - approve
    collateral.safeIncreaseAllowance(poolData.moneyMarket, amount);
    IPool(poolData.moneyMarket).deposit(
      address(collateral),
      amount,
      msg.sender,
      uint16(0)
    );

    // calculate accrued interest since last operation
    (poolInterest, daoInterest) = calculateGeneratedInterest(poolData);

    // aave tokens are always 1:1
    tokensOut = amount;
  }

  function withdraw(
    ILendingProxy.PoolStorage poolData,
    uint256 amount,
    address recipient
  )
    external
    returns (
      uint256 tokensOut,
      uint256 poolInterest,
      uint256 daoInterest
    )
  {
    // retrieve aTokens
    IERC20 collateral = ISynthereumDeployment(msg.sender).collateralToken();
    IERC20(poolData.interestBearingToken).safeTransferFrom(
      msg.sender,
      address(this),
      amount
    );

    // aave withdraw - approve
    IERC20(poolData.interestBearingToken).safeIncreaseAllowance(
      poolData.moneyMarket,
      amount
    );
    IPool(poolData.moneyMarket).withdraw(
      address(collateral),
      amount,
      recipient
    );

    // calculate interest splitting on delta deposit
    (poolInterest, daoInterest) = calculateGeneratedInterest(poolData);

    // aave tokens are always 1:1
    tokensOut = amount;
  }

  function calculateGeneratedInterest(ILendingProxy.PoolStorage memory pool)
    internal
    view
    returns (uint256 poolInterest, uint256 daoInterest)
  {
    uint256 ratio = pool.daoInterestShare;

    // get current pool scaled balance of collateral
    uint256 poolBalance =
      IScaledBalanceToken(pool.interestBearingToken).scaledBalanceOf(
        msg.sender
      );

    // the total interest is delta between current balance and lastBalance
    totalInterestGenerated =
      poolBalance -
      pool.collateralDeposited -
      pool.unclaimedDaoInterest;
    daoInterest = (totalInterestGenerated * ratio) / 100;
    poolInterest = (totalInterestGenerated * (100 - ratio)) / 100;
  }
}
