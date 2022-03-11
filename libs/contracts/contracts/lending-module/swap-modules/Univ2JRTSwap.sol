// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity 0.8.9;

import {Address} from '@openzeppelin/contracts/utils/Address.sol';
import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {
  SafeERC20
} from '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import {ISynthereumDeployment} from '../../common/interfaces/IDeployment.sol';
import {
  IUniswapV2Router02
} from '@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol';

contract UniV2JRTSwapModule {
  using SafeERC20 for IERC20;

  struct SwapInfo {
    address routerAddress;
    address[] tokenSwapPath;
    uint256 expiration;
  }

  function swapToJRT(
    address recipient,
    uint256 amountIn,
    bytes memory params
  ) external returns (uint256 amountOut) {
    IERC20 collateral = ISynthereumDeployment(msg.sender).collateralToken();

    // decode swapInfo
    SwapInfo memory swapInfo = abi.decode(params, (SwapInfo));

    // swap to JRT to final recipient
    IUniswapV2Router02 router = IUniswapV2Router02(swapInfo.routerAddress);

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
