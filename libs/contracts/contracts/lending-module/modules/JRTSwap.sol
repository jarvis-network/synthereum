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

contract JRTSwapModule {
  struct SwapInfo {
    address routerAddress;
    address[] tokenSwapPath;
    uint256 expiration;
  }

  function swapToJRT(
    address recipient,
    uint256 amountIn,
    bytes params
  ) returns (uint256 amountOut) {
    // decode swapInfo
    SwapInfo memory swapInfo = abi.decode(params, (SwapInfo));

    // swap to JRT to final recipient
    IUniswapV2Router02 router = IUniswapV2Router02(swapInfo.swapRouter);

    collateral.safeIncreaseAllowance(address(router), amountIn);
    amountOut = router.swapExactTokensForTokens(
      amountIn,
      0,
      swapInfo.tokenSwapPath,
      recipient,
      swapInfo.expiration
    )[swapInfo.tokenSwapPath.length - 1];
  }
}
