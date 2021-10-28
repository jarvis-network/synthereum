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
  /// @param synthereumParams: params to interact with synthereum
  /// @return returnValues see atomicSwapProxy.ReturnValues struct
  function swapToCollateralAndMint(
    bytes calldata info,
    IAtomicSwapProxy.SwapMintParams memory inputParams,
    IAtomicSwapProxy.SynthereumMintParams memory synthereumParams
  )
    external
    payable
    returns (IAtomicSwapProxy.ReturnValues memory returnValues);

  /// @param info: ImplementationInfo related to this implementation
  /// @param inputParams: see atomicSwapProxy.RedeemSwapParams struct
  /// @param synthereumParams: params to interact with synthereum
  /// @param recipient: recipient of the output tokens
  /// @return returnValues see atomicSwapProxy.ReturnValues struct
  function redeemCollateralAndSwap(
    bytes calldata info,
    IAtomicSwapProxy.RedeemSwapParams memory inputParams,
    IAtomicSwapProxy.SynthereumRedeemParams memory synthereumParams,
    address recipient
  ) external returns (IAtomicSwapProxy.ReturnValues memory);
}
