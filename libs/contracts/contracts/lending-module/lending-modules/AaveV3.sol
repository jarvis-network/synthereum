// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.10;

import {IPoolStorageManager} from '../interfaces/IPoolStorageManager.sol';
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
import {ILendingModule} from '../interfaces/ILendingModule.sol';

contract AaveV3Module is ILendingModule {
  using SafeERC20 for IERC20;

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
    )
  {
    // calculate accrued interest since last operation
    (poolInterest, daoInterest) = calculateGeneratedInterest(poolData);

    // retrievve pool collateral
    IERC20 collateral = IERC20(poolData.collateral);
    collateral.safeTransferFrom(msg.sender, address(this), amount);

    // aave deposit - approve
    address moneyMarket =
      decodeLendingArgs(storageManager, poolData.lendingModule);
    collateral.safeIncreaseAllowance(moneyMarket, amount);
    IPool(moneyMarket).deposit(
      address(collateral),
      amount,
      msg.sender,
      uint16(0)
    );

    // aave tokens are always 1:1
    tokensOut = amount;
  }

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
    )
  {
    // calculate accrued interest since last operation
    (poolInterest, daoInterest) = calculateGeneratedInterest(poolData);

    // retrieve aTokens
    IERC20(poolData.interestBearingToken).safeTransferFrom(
      msg.sender,
      address(this),
      amount
    );

    // aave withdraw - approve
    address moneyMarket =
      decodeLendingArgs(storageManager, poolData.lendingModule);
    IERC20(poolData.interestBearingToken).safeIncreaseAllowance(
      moneyMarket,
      amount
    );
    IPool(moneyMarket).withdraw(poolData.collateral, amount, recipient);

    // aave tokens are always 1:1
    tokensOut = amount;
  }

  function decodeLendingArgs(
    IPoolStorageManager storageManager,
    address lendingModule
  ) internal view returns (address) {
    return abi.decode(storageManager.getLendingArgs(lendingModule), (address));
  }

  function calculateGeneratedInterest(
    IPoolStorageManager.PoolStorage calldata pool
  ) internal view returns (uint256 poolInterest, uint256 daoInterest) {
    uint256 ratio = pool.daoInterestShare;

    // get current pool scaled balance of collateral
    uint256 poolBalance =
      IScaledBalanceToken(pool.interestBearingToken).scaledBalanceOf(
        msg.sender
      );

    // the total interest is delta between current balance and lastBalance
    uint256 totalInterestGenerated =
      poolBalance -
        pool.collateralDeposited -
        pool.unclaimedDaoCommission -
        pool.unclaimedDaoJRT;
    daoInterest = (totalInterestGenerated * ratio) / 100;
    poolInterest = (totalInterestGenerated * (100 - ratio)) / 100;
  }
}
