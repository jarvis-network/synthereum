// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity 0.8.9;

import {Address} from '@openzeppelin/contracts/utils/Address.sol';
import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {
  SafeERC20
} from '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import {ISynthereumDeployment} from '../../common/interfaces/IDeployment.sol';
import {IBalancerVault} from '../interfaces/IBalancerVault.sol';
import {IJRTSwapModule} from '../interfaces/IJrtSwapModule.sol';

contract BalancerJRTSwapModule is IJRTSwapModule {
  using SafeERC20 for IERC20;

  struct SwapInfo {
    bytes32 poolId;
    address routerAddress;
    address jrtAddress;
    uint256 minTokensOut; // anti slippage
    uint256 expiration;
  }

  function swapToJRT(
    address recipient,
    uint256 amountIn,
    bytes memory params
  ) external override returns (uint256 amountOut) {
    IERC20 collateral = ISynthereumDeployment(msg.sender).collateralToken();

    // decode swapInfo
    SwapInfo memory swapInfo = abi.decode(params, (SwapInfo));

    // build params 
    IBalancerVault.SingleSwap memory singleSwap = IBalancerVault.SingleSwap(
        swapInfo.poolId,
        IBalancerVault.SwapKind.GIVEN_IN,
        collateral.address,
        swapInfo.jrtAddress,
        amountIn,
        '0x00'
    );

    IBalancerVault.FundManagement memory funds = IBalancerVault.FundManagement(
        address(this),
        false,
        recipient,
        false
    );

    // swap to JRT to final recipient
    IBalancerVault router = IBalancerVault(swapInfo.routerAddress);

    collateral.safeIncreaseAllowance(address(router), amountIn);
    amountOut = router.swap(singleSwap, funds, swapInfo.minTokensOut, swapInfo.expiration);
  }
}
