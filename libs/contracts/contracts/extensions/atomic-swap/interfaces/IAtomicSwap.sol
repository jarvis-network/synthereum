pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import {
  ISynthereumPoolOnChainPriceFeed
} from '../synthereum-pool/v4/interfaces/IPoolOnChainPriceFeed.sol';
import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';

interface IAtomicSwap {
  function swapExactTokensAndMint(
    uint256 tokenAmountIn,
    uint256 collateralAmountOut,
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

  function swapTokensForExactAndMint(
    uint256 tokenAmountIn,
    uint256 collateralAmountOut,
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

  function redeemAndSwapExactTokens(
    uint256 amountTokenOut,
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

  function redeemAndSwapTokensForExact(
    uint256 amountTokenOut,
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

  function swapExactETHAndMint(
    uint256 collateralAmountOut,
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

  function swapETHForExactAndMint(
    uint256 collateralAmountOut,
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

  function redeemAndSwapExactTokensForETH(
    uint256 amountTokenOut,
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

  function redeemAndSwapTokensForExactETH(
    uint256 amountTokenOut,
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
