// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import {
  ISynthereumPoolOnChainPriceFeed
} from '../synthereum-pool/v4/interfaces/IPoolOnChainPriceFeed.sol';
import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';

interface IAtomicSwap {
  function swapAndMint(
    uint256 tokenAmountIn,
    uint256 collateralAmountOutMin,
    address[] calldata tokenSwapPath,
    ISynthereumPoolOnChainPriceFeed synthereumPool,
    ISynthereumPoolOnChainPriceFeed.MintParams memory mintParams
  )
    external
    returns (
      uint256 collateralOut,
      IERC20 synthToken,
      uint256 syntheticTokensMinted
    );

  function redeemAndSwap(
    uint256 amountTokenOutMin,
    address[] calldata tokenSwapPath,
    ISynthereumPoolOnChainPriceFeed synthereumPool,
    ISynthereumPoolOnChainPriceFeed.RedeemParams memory redeemParams,
    address recipient
  )
    external
    returns (
      uint256 collateralRedeemed,
      IERC20 outputToken,
      uint256 outputTokenAmount
    );

  function swapETHAndMint(
    uint256 collateralAmountOutMin,
    address[] calldata tokenSwapPath,
    ISynthereumPoolOnChainPriceFeed synthereumPool,
    ISynthereumPoolOnChainPriceFeed.MintParams memory mintParams
  )
    external
    payable
    returns (
      uint256 collateralOut,
      IERC20 synthToken,
      uint256 syntheticTokensMinted
    );

  function redeemAndSwapETH(
    uint256 amountTokenOutMin,
    address[] calldata tokenSwapPath,
    ISynthereumPoolOnChainPriceFeed synthereumPool,
    ISynthereumPoolOnChainPriceFeed.RedeemParams memory redeemParams,
    address recipient
  )
    external
    returns (
      uint256 collateralRedeemed,
      IERC20 outputToken,
      uint256 outputTokenAmount
    );
}
