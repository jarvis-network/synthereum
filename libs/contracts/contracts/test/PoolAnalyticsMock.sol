// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity 0.8.9;

import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {ISynthereumFinder} from '../core/interfaces/IFinder.sol';
import {
  ILendingManager
} from '../lending-module/interfaces/ILendingManager.sol';
import {
  ILendingStorageManager
} from '../lending-module/interfaces/ILendingStorageManager.sol';
import {
  ISynthereumMultiLpLiquidityPool
} from '../synthereum-pool/v6/interfaces/IMultiLpLiquidityPool.sol';
import {SynthereumInterfaces} from '../core/Constants.sol';

contract PoolAnalyticsMock {
  ISynthereumFinder immutable finder;

  struct TotalCollateral {
    uint256 usersCollateral;
    uint256 lpsCollateral;
    uint256 totalCollateral;
  }

  struct Interest {
    uint256 poolInterest;
    uint256 daoInterest;
  }

  struct Amounts {
    uint256 totalSynthTokens;
    uint256 totLiquidity;
    uint256 poolBearingBalance;
    uint256 poolCollBalance;
    uint256 expectedBearing;
  }

  constructor(address _finder) {
    finder = ISynthereumFinder(_finder);
  }

  function getAllPoolData(address pool, address[] calldata lps)
    external
    returns (
      ILendingStorageManager.PoolStorage memory poolData,
      TotalCollateral memory totColl,
      Amounts memory amounts,
      ISynthereumMultiLpLiquidityPool.LPInfo[] memory lpsInfo,
      Interest memory interest
    )
  {
    ILendingStorageManager storageManager =
      ILendingStorageManager(
        finder.getImplementationAddress(
          SynthereumInterfaces.LendingStorageManager
        )
      );
    ILendingManager lendingManager =
      ILendingManager(
        finder.getImplementationAddress(SynthereumInterfaces.LendingManager)
      );
    poolData = storageManager.getPoolData(pool);
    ISynthereumMultiLpLiquidityPool poolContract =
      ISynthereumMultiLpLiquidityPool(pool);
    (
      totColl.usersCollateral,
      totColl.lpsCollateral,
      totColl.totalCollateral
    ) = poolContract.totalCollateralAmount();
    amounts.totalSynthTokens = poolContract.totalSyntheticTokens();
    amounts.totLiquidity = poolContract.totalAvailableLiquidity();
    amounts.poolBearingBalance = IERC20(poolData.interestBearingToken)
      .balanceOf(pool);
    amounts.poolCollBalance = IERC20(poolData.collateral).balanceOf(pool);
    (interest.poolInterest, interest.daoInterest, ) = lendingManager
      .getAccumulatedInterest(pool);
    (amounts.expectedBearing, ) = lendingManager.collateralToInterestToken(
      pool,
      poolData.collateralDeposited +
        poolData.unclaimedDaoJRT +
        poolData.unclaimedDaoCommission +
        interest.poolInterest +
        interest.daoInterest,
      true
    );
    lpsInfo = new ISynthereumMultiLpLiquidityPool.LPInfo[](lps.length);
    for (uint256 j = 0; j < lps.length; j++) {
      lpsInfo[j] = poolContract.positionLPInfo(lps[j]);
    }
  }
}
