// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;
pragma experimental ABIEncoderV2;

import {
  ISynthereumPoolOnChainPriceFeed
} from '@jarvis-network/synthereum-contracts/contracts/synthereum-pool/v4/interfaces/IPoolOnChainPriceFeed.sol';

/// @notice general interface that atomic swap implementations must adhere to
/// @notice in order to be callable through the proxy pattern
interface IAtomicSwapV2 {
  /// @notice parameters saved in proxy useful for a specific implementation
  /// @param routerAddress address of the related swap router
  /// @param synthereumFinder synthereum finder address
  /// @param nativeCryptoAddress address of the native wrapped crypto (ie WETH)
  struct ImplementationInfo {
    address routerAddress;
    address synthereumFinder;
    address nativeCryptoAddress;
  }

  /// @param info: ImplementationInfo related to this implementationss
  /// @param isExactInput: determine if exactAmount is to be treated as exactInput (true) or exactOutput (false)
  /// @param exactAmount: exact input or exact output based on boolean
  /// @param minOutOrMaxIn: anti-slippage - minimum amount out or max amount in based on boolean
  /// @param tokenSwapPath: token addresses to route through - input to output, which is synthereum collateral
  /// @param extraParams: dynamic-size bytes to encode extra parameters
  /// @param synthereumPool: synthereum pool address used to mint with collateral
  /// @param mintParams: struct to mint from synthereum pool with collateral taken from swap
  /// @return amountOut amount of received jSynths
  function swapToCollateralAndMint(
    ImplementationInfo memory info,
    bool isExactInput,
    uint256 exactAmount,
    uint256 minOutOrMaxIn,
    address[] memory tokenSwapPath,
    bytes memory extraParams,
    ISynthereumPoolOnChainPriceFeed synthereumPool,
    ISynthereumPoolOnChainPriceFeed.MintParams memory mintParams
  ) external payable returns (uint256 amountOut);

  /// @param info: ImplementationInfo related to this implementationss
  /// @param isExactInput: determine if exactAmount is to be treated as exactInput (true) or exactOutput (false)
  /// @param exactAmount: exact input or exact output based on boolean
  /// @param minOutOrMaxIn: anti-slippage - minimum amount out or max amount in based on boolean
  /// @param tokenSwapPath: token addresses to route through - input (synthereum collateral) to output
  /// @param extraParams: dynamic-size bytes to encode extra parameters
  /// @param synthereumPool: synthereum pool address used to redeem collateral with jSynths
  /// @param redeemParams: struct to redeem collateral from synthereum pool with input jSynth
  /// @param recipient: recipient of the output tokens
  /// @return amountOut amount of received ERC20
  function redeemCollateralAndSwap(
    ImplementationInfo memory info,
    bool isExactInput,
    uint256 exactAmount,
    uint256 minOutOrMaxIn,
    address[] memory tokenSwapPath,
    bytes memory extraParams,
    ISynthereumPoolOnChainPriceFeed synthereumPool,
    ISynthereumPoolOnChainPriceFeed.RedeemParams memory redeemParams,
    address payable recipient
  ) external returns (uint256);
}
