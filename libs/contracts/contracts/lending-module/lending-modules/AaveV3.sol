// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity 0.8.9;

import {ILendingStorageManager} from '../interfaces/ILendingStorageManager.sol';
import {IPool} from '../interfaces/IAaveV3.sol';
import {IScaledBalanceToken} from '../interfaces/IScaledBalanceToken.sol';
import {Address} from '@openzeppelin/contracts/utils/Address.sol';
import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {
  SafeERC20
} from '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import {ILendingModule} from '../interfaces/ILendingModule.sol';

contract AaveV3Module is ILendingModule {
  using SafeERC20 for IERC20;

  function deposit(
    ILendingStorageManager.PoolStorage calldata poolData,
    bytes memory lendingArgs,
    uint256 amount
  )
    external
    returns (
      uint256 poolInterest,
      uint256 daoInterest,
      uint256 tokensOut,
      uint256 tokensTransferred
    )
  {
    // calculate accrued interest since last operation
    (poolInterest, daoInterest) = calculateGeneratedInterest(
      msg.sender,
      poolData,
      amount,
      true
    );

    // proxy should have received collateral from the pool
    IERC20 collateral = IERC20(poolData.collateral);
    require(collateral.balanceOf(address(this)) >= amount, 'Wrong balance');

    // aave deposit - approve
    address moneyMarket = abi.decode(lendingArgs, (address));

    collateral.safeIncreaseAllowance(moneyMarket, amount);
    IPool(moneyMarket).deposit(
      address(collateral),
      amount,
      msg.sender,
      uint16(0)
    );

    // aave tokens are always 1:1
    tokensOut = amount;
    tokensTransferred = amount;
  }

  function withdraw(
    ILendingStorageManager.PoolStorage calldata poolData,
    bytes memory lendingArgs,
    uint256 aTokensAmount,
    address recipient
  )
    external
    returns (
      uint256 poolInterest,
      uint256 daoInterest,
      uint256 tokensOut,
      uint256 tokensTransferred
    )
  {
    // calculate accrued interest since last operation
    (poolInterest, daoInterest) = calculateGeneratedInterest(
      msg.sender,
      poolData,
      aTokensAmount,
      false
    );
    // proxy should have received interest tokens from the pool
    IERC20 interestToken = IERC20(poolData.interestBearingToken);
    require(
      interestToken.balanceOf(address(this)) >= aTokensAmount,
      'Wrong balance'
    );

    // aave withdraw - approve
    address moneyMarket = abi.decode(lendingArgs, (address));

    interestToken.safeIncreaseAllowance(moneyMarket, aTokensAmount);
    IPool(moneyMarket).withdraw(poolData.collateral, aTokensAmount, recipient);

    // aave tokens are always 1:1
    tokensOut = aTokensAmount;
    tokensTransferred = aTokensAmount;
  }

  function getAccumulatedInterest(
    address poolAddress,
    ILendingStorageManager.PoolStorage calldata poolData
  ) external view returns (uint256 poolInterest, uint256 daoInterest) {
    (poolInterest, daoInterest) = calculateGeneratedInterest(
      poolAddress,
      poolData,
      0,
      true
    );
  }

  function getInterestBearingToken(address collateral, bytes memory args)
    external
    returns (address token)
  {
    address moneyMarket = abi.decode(args, (address));
    token = IPool(moneyMarket).getReserveData(collateral).aTokenAddress;
  }

  function collateralToInterestToken(
    uint256 collateralAmount,
    address collateral,
    address interestToken,
    bytes memory extraArgs,
    bool isExactAmount
  ) external view returns (uint256 interestTokenAmount) {
    interestTokenAmount = collateralAmount;
  }

  function calculateGeneratedInterest(
    address poolAddress,
    ILendingStorageManager.PoolStorage calldata pool,
    uint256 amount,
    bool isDeposit
  ) internal view returns (uint256 poolInterest, uint256 daoInterest) {
    if (pool.collateralDeposited == 0) return (0, 0);

    uint256 ratio = pool.daoInterestShare;
    // get current pool total amount of collateral
    uint256 poolBalance =
      IERC20(pool.interestBearingToken).balanceOf(poolAddress);

    // the total interest is delta between current balance and lastBalance
    uint256 totalInterestGenerated;
    if (isDeposit) {
      totalInterestGenerated =
        poolBalance -
        pool.collateralDeposited -
        pool.unclaimedDaoCommission -
        pool.unclaimedDaoJRT;
    } else {
      totalInterestGenerated =
        poolBalance +
        amount -
        pool.collateralDeposited -
        pool.unclaimedDaoCommission -
        pool.unclaimedDaoJRT;
    }

    daoInterest = (totalInterestGenerated * ratio) / 10**18;
    poolInterest = totalInterestGenerated - daoInterest;
  }
}
