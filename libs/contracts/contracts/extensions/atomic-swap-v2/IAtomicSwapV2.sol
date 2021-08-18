// SPDX-License-Identifier: MIT

pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import {
  ISynthereumPoolOnChainPriceFeed
} from '../../synthereum-pool/v4/interfaces/IPoolOnChainPriceFeed.sol';

interface IAtomicSwapV2 {
  /// @param isExactInput: determine if amountSpecified is to be treated as exactInput (true) or exactOutput (false)
  /// @param amountSpecified: exact input | exact output based on boolean
  /// @param minOutOrMaxIn: anti-slippage - minimum amount out | max amount in based on boolean
  /// @param tokenSwapPath: token addresses to route through - input to output, which is synthereum collateral
  /// @param synthereumPool: synthereum pool address used to mint with collateral
  /// @param mintParams: struct to mint from synthereum pool with collateral taken from swap
  /// @return amountOut amount of received jSynths
  function swapToCollateralAndMint(
    bool isExactInput,
    uint256 amountSpecified,
    uint256 minOutOrMaxIn,
    address[] calldata tokenSwapPath,
    ISynthereumPoolOnChainPriceFeed synthereumPool,
    ISynthereumPoolOnChainPriceFeed.MintParams memory mintParams
  ) external returns (uint256 amountOut);

  /// @param isExactInput: determine if msg.value is to be treated as exactInput (true) or exactOutput (false)
  /// @param minOutOrMaxIn: anti-slippage - minimum amount out | max amount in based on boolean
  /// @param tokenSwapPath: token addresses to route through - input to output, which is synthereum collateral
  /// @param synthereumPool: synthereum pool address used to mint with collateral
  /// @param mintParams: struct to mint from synthereum pool with collateral taken from swap
  /// @return amountOut amount of received jSynths
  function swapETHToCollateralAndMint(
    bool isExactInput,
    uint256 minOutOrMaxIn,
    address[] calldata tokenSwapPath,
    ISynthereumPoolOnChainPriceFeed synthereumPool,
    ISynthereumPoolOnChainPriceFeed.MintParams memory mintParams
  ) external payable returns (uint256 amountOut);

  /// @param isExactInput: determine if amountSpecified is to be treated as exactInput (true) or exactOutput (false)
  /// @param amountSpecified: exact input | exact output based on boolean
  /// @param minOutOrMaxIn: anti-slippage - minimum amount out | max amount in based on boolean
  /// @param tokenSwapPath: token addresses to route through - input (synthereum collateral) to output
  /// @param synthereumPool: synthereum pool address used to redeem collateral with jSynths
  /// @param redeemParams: struct to redeem collateral from synthereum pool with input jSynth
  /// @param recipient: recipient of the output tokens
  /// @return amountOut amount of received ERC20
  function redeemCollateralAndSwap(
    bool isExactInput,
    int256 amountSpecified,
    int256 minOutOrMaxIn,
    address[] calldata tokenSwapPath,
    ISynthereumPoolOnChainPriceFeed synthereumPool,
    ISynthereumPoolOnChainPriceFeed.RedeemParams memory redeemParams,
    address recipient
  ) external returns (uint256 amountOut);

  /// @param isExactInput: determine if msg.value is to be treated as exactInput (true) or exactOutput (false)
  /// @param minOutOrMaxIn: anti-slippage - minimum amount out | max amount in based on boolean
  /// @param tokenSwapPath: token addresses to route through - input (synthereum collateral) to output
  /// @param synthereumPool: synthereum pool address used to redeem collateral with jSynths
  /// @param redeemParams: struct to redeem collateral from synthereum pool with input jSynth
  /// @param recipient: recipient of the output tokens
  /// @return amountOut amount of received ERC20
  function redeemCollateralAndSwapETH(
    bool isExactInput,
    uint256 minOutOrMaxIn,
    address[] calldata tokenSwapPath,
    ISynthereumPoolOnChainPriceFeed synthereumPool,
    ISynthereumPoolOnChainPriceFeed.RedeemParams memory redeemParams,
    address recipient
  ) external payable returns (uint256 amountOut);
}
