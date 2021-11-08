// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;
pragma experimental ABIEncoderV2;

import {
  ISynthereumLiquidityPool
} from '@jarvis-network/synthereum-contracts/contracts/synthereum-pool/v5/interfaces/ILiquidityPool.sol';
import {
  IOnChainLiquidityRouterV2
} from '../interfaces/IOnChainLiquidityRouter.sol';

/// @notice general interface that OCLR implementations must adhere to
/// @notice in order to be callable through the proxy pattern
interface IOCLRBase {
  /// @param info: ImplementationInfo related to this implementation
  /// @param inputParams: params involving the swap - see IOnChainLiquidityRouter.MintSwapParams struct
  /// @param synthereumParams: params to interact with synthereum - see IOnChainLiquidityRouter.SynthereumMintParams struct
  /// @return returnValues see IOnChainLiquidityRouter.ReturnValues struct
  function swapToCollateralAndMint(
    bytes calldata info,
    IOnChainLiquidityRouterV2.SwapMintParams memory inputParams,
    IOnChainLiquidityRouterV2.SynthereumMintParams memory synthereumParams
  )
    external
    payable
    returns (IOnChainLiquidityRouterV2.ReturnValues memory returnValues);

  /// @param info: ImplementationInfo related to this implementation
  /// @param inputParams: params involving the swap - see IOnChainLiquidityRouter.RedeemSwapParams struct
  /// @param synthereumParams: params to interact with synthereum - see IOnChainLiquidityRouter.SynthereumRedeemParams struct
  /// @param recipient: recipient of the output tokens
  /// @return returnValues see IOnChainLiquidityRouter.ReturnValues struct
  function redeemCollateralAndSwap(
    bytes calldata info,
    IOnChainLiquidityRouterV2.RedeemSwapParams memory inputParams,
    IOnChainLiquidityRouterV2.SynthereumRedeemParams memory synthereumParams,
    address recipient
  ) external returns (IOnChainLiquidityRouterV2.ReturnValues memory);
}
