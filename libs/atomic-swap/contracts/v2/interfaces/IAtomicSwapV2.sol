// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;
pragma experimental ABIEncoderV2;

import {
  ISynthereumPoolOnChainPriceFeed
} from '@jarvis-network/synthereum-contracts/contracts/synthereum-pool/v4/interfaces/IPoolOnChainPriceFeed.sol';

import {IAtomicSwapProxy} from '../interfaces/IProxy.sol';

/// @notice general interface that atomic swap implementations must adhere to
/// @notice in order to be callable through the proxy pattern
interface IAtomicSwapV2 {
  /// @param info: ImplementationInfo related to this implementation
  /// @param inputParams: see atomicSwapProxy.MintSwapParams struct
  /// @param synthereumPool: synthereum pool address used to mint with collateral
  /// @param mintParams: struct to mint from synthereum pool with collateral taken from swap
  /// @return returnValues see atomicSwapProxy.ReturnValues struct
  function swapToCollateralAndMint(
    bytes calldata info,
    IAtomicSwapProxy.SwapMintParams memory inputParams,
    ISynthereumPoolOnChainPriceFeed synthereumPool,
    ISynthereumPoolOnChainPriceFeed.MintParams memory mintParams
  )
    external
    payable
    returns (IAtomicSwapProxy.ReturnValues memory returnValues);

  /// @param info: ImplementationInfo related to this implementation
  /// @param inputParams: see atomicSwapProxy.RedeemSwapParams struct
  /// @param synthereumPool: synthereum pool address used to redeem collateral with jSynths
  /// @param redeemParams: struct to redeem collateral from synthereum pool with input jSynth
  /// @param recipient: recipient of the output tokens
  /// @return returnValues see atomicSwapProxy.ReturnValues struct
  function redeemCollateralAndSwap(
    bytes calldata info,
    IAtomicSwapProxy.RedeemSwapParams memory inputParams,
    ISynthereumPoolOnChainPriceFeed synthereumPool,
    ISynthereumPoolOnChainPriceFeed.RedeemParams memory redeemParams,
    address recipient
  ) external returns (IAtomicSwapProxy.ReturnValues memory);
}
