// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;
pragma experimental ABIEncoderV2;

import {
  ISynthereumPoolOnChainPriceFeed
} from '@jarvis-network/synthereum-contracts/contracts/synthereum-pool/v4/interfaces/IPoolOnChainPriceFeed.sol';

import {
  IOnChainLiquidityRouter
} from '../interfaces/IOnChainLiquidityRouter.sol';

/// @notice general interface that OCLR implementations must adhere to
/// @notice in order to be callable through the proxy pattern
interface IOCLRBase {
  /// @param info: ImplementationInfo related to this implementation
  /// @param inputParams: see IOnChainLiquidityRouter.MintSwapParams struct
  /// @param synthereumParams: params to interact with synthereum
  /// @return returnValues see IOnChainLiquidityRouter.ReturnValues struct
  function swapToCollateralAndMint(
    bytes calldata info,
    IOnChainLiquidityRouter.SwapMintParams memory inputParams,
    IOnChainLiquidityRouter.SynthereumMintParams memory synthereumParams
  )
    external
    payable
    returns (IOnChainLiquidityRouter.ReturnValues memory returnValues);

  /// @param info: ImplementationInfo related to this implementation
  /// @param inputParams: see IOnChainLiquidityRouter.RedeemSwapParams struct
  /// @param synthereumParams: params to interact with synthereum
  /// @param recipient: recipient of the output tokens
  /// @return returnValues see IOnChainLiquidityRouter.ReturnValues struct
  function redeemCollateralAndSwap(
    bytes calldata info,
    IOnChainLiquidityRouter.RedeemSwapParams memory inputParams,
    IOnChainLiquidityRouter.SynthereumRedeemParams memory synthereumParams,
    address recipient
  ) external returns (IOnChainLiquidityRouter.ReturnValues memory);
}
