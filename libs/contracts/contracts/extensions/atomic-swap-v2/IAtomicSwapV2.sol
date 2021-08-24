// SPDX-License-Identifier: MIT

pragma solidity >=0.7.5;
pragma experimental ABIEncoderV2;

import {
  ISynthereumPoolOnChainPriceFeed
} from '../../synthereum-pool/v4/interfaces/IPoolOnChainPriceFeed.sol';

/// @notice general interface that atomic swap implementations must adhere to
/// @notice in order to be callable through the proxy pattern
interface IAtomicSwapV2 {
  /// @param isExactInput: determine if amountSpecified is to be treated as exactInput (true) or exactOutput (false)
  /// @param amountSpecified: exact input | exact output based on boolean
  /// @param minOutOrMaxIn: anti-slippage - minimum amount out | max amount in based on boolean
  /// @param tokenSwapPath: token addresses to route through - input to output, which is synthereum collateral
  /// @param poolsPath: pools addresses to route through where many pools can exist for same pair
  /// @param synthereumPool: synthereum pool address used to mint with collateral
  /// @param mintParams: struct to mint from synthereum pool with collateral taken from swap
  /// @return amountOut amount of received jSynths
  function swapToCollateralAndMint(
    bool isExactInput,
    uint256 amountSpecified,
    uint256 minOutOrMaxIn,
    address[] memory tokenSwapPath,
    address[] memory poolsPath,
    ISynthereumPoolOnChainPriceFeed synthereumPool,
    ISynthereumPoolOnChainPriceFeed.MintParams memory mintParams
  ) external payable returns (uint256 amountOut);

  /// @param isExactInput: determine if amountSpecified is to be treated as exactInput (true) or exactOutput (false)
  /// @param amountSpecified: exact input | exact output based on boolean
  /// @param minOutOrMaxIn: anti-slippage - minimum amount out | max amount in based on boolean
  /// @param tokenSwapPath: token addresses to route through - input (synthereum collateral) to output
  /// @param poolsPath: pools addresses to route through where many pools can exist for same pair
  /// @param synthereumPool: synthereum pool address used to redeem collateral with jSynths
  /// @param redeemParams: struct to redeem collateral from synthereum pool with input jSynth
  /// @param recipient: recipient of the output tokens
  /// @return amountOut amount of received ERC20
  function redeemCollateralAndSwap(
    bool isExactInput,
    uint256 amountSpecified,
    uint256 minOutOrMaxIn,
    address[] memory tokenSwapPath,
    address[] memory poolsPath,
    ISynthereumPoolOnChainPriceFeed synthereumPool,
    ISynthereumPoolOnChainPriceFeed.RedeemParams memory redeemParams,
    address payable recipient
  ) external returns (uint256);
}
