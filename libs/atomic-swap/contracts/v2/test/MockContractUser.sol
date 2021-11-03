// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.4;

import '../interfaces/IOnChainLiquidityRouter.sol';

contract MockContractUser {
  constructor() {}

  function swapAndMint(
    address proxyAddress,
    string calldata implementationId,
    IOnChainLiquidityRouter.SwapMintParams memory inputParams,
    ISynthereumPoolOnChainPriceFeed synthereumPool,
    ISynthereumPoolOnChainPriceFeed.MintParams memory mintParams
  ) external payable {
    IOnChainLiquidityRouter(proxyAddress).swapAndMint{value: msg.value}(
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
    IOnChainLiquidityRouter.RedeemSwapParams memory inputParams,
    ISynthereumPoolOnChainPriceFeed synthereumPool,
    ISynthereumPoolOnChainPriceFeed.RedeemParams memory redeemParams,
    address recipient
  ) external {
    IOnChainLiquidityRouter(proxyAddress).redeemAndSwap(
      implementationId,
      inputParams,
      synthereumPool,
      redeemParams,
      recipient
    );
  }
}
