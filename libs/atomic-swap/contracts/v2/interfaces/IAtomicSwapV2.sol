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
  /// @param isExactInput: determine if exactAmount is to be treated as exactInput (true) or exactOutput (false)
  /// @param exactAmount: exact input or exact output based on boolean
  /// @param minOutOrMaxIn: anti-slippage - minimum amount out or max amount in based on boolean
  /// @param extraParams: dynamic-size bytes to encode extra parameters
  /// @param synthereumPool: synthereum pool address used to mint with collateral
  /// @param mintParams: struct to mint from synthereum pool with collateral taken from swap
  /// @return returnValues see atomicSwapProxy.ReturnValues struct
  function swapToCollateralAndMint(
    bytes calldata info,
    bool isExactInput,
    uint256 exactAmount,
    uint256 minOutOrMaxIn,
    bytes memory extraParams,
    ISynthereumPoolOnChainPriceFeed synthereumPool,
    ISynthereumPoolOnChainPriceFeed.MintParams memory mintParams
  )
    external
    payable
    returns (IAtomicSwapProxy.ReturnValues memory returnValues);

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
