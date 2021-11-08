// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.4;

import '../interfaces/IOnChainLiquidityRouter.sol';

contract MockContractUserV2 {
  constructor() {}

  function swapAndMint(
    address proxyAddress,
    string calldata implementationId,
    IOnChainLiquidityRouterV2.SwapMintParams memory inputParams,
    ISynthereumLiquidityPool synthereumPool,
    ISynthereumLiquidityPool.MintParams memory mintParams
  ) external payable {
    IOnChainLiquidityRouterV2(proxyAddress).swapAndMint{value: msg.value}(
      implementationId,
      inputParams,
      synthereumPool,
      mintParams
    );
  }

  function getEth() external payable {}

  function redeemAndSwap(
    address proxyAddress,
    string calldata implementationId,
    IOnChainLiquidityRouterV2.RedeemSwapParams memory inputParams,
    ISynthereumLiquidityPool synthereumPool,
    ISynthereumLiquidityPool.RedeemParams memory redeemParams,
    address recipient
  ) external {
    IOnChainLiquidityRouterV2(proxyAddress).redeemAndSwap(
      implementationId,
      inputParams,
      synthereumPool,
      redeemParams,
      recipient
    );
  }
}
