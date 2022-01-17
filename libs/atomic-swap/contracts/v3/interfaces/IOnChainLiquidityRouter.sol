// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;

import {
  ISynthereumLiquidityPool
} from '@jarvis-network/synthereum-contracts/contracts/synthereum-pool/v5/interfaces/ILiquidityPool.sol';
import {
  ISynthereumFinder
} from '@jarvis-network/synthereum-contracts/contracts/core/interfaces/IFinder.sol';

interface IOnChainLiquidityRouterV2 {
  // Role structure
  struct Roles {
    address admin;
    address[] maintainers;
  }

  // return values from delegate call
  struct ReturnValues {
    address inputToken;
    address outputToken;
    address collateralToken;
    uint256 inputAmount;
    uint256 outputAmount;
    uint256 collateralAmountRefunded;
  }

  // input values for implementation
  struct RedeemSwapParams {
    bool isExactInput;
    bool unwrapToETH;
    uint256 exactAmount;
    uint256 minOutOrMaxIn;
    bytes extraParams;
    address msgSender; // meta-tx support
  }

  // input values for implementation
  struct SwapMintParams {
    bool isExactInput;
    uint256 exactAmount;
    uint256 minOutOrMaxIn;
    bytes extraParams;
    address msgSender; //meta-tx support
  }

  // input values for fixedRateSwap to call a OCLR implementation
  struct SwapMintPegParams {
    SwapMintParams swapMintParams;
    SynthereumMintParams mintParams;
  }

  // synthereum variables
  struct SynthereumMintParams {
    ISynthereumFinder synthereumFinder;
    ISynthereumLiquidityPool synthereumPool;
    ISynthereumLiquidityPool.MintParams mintParams;
  }

  // synthereum variables
  struct SynthereumRedeemParams {
    ISynthereumFinder synthereumFinder;
    ISynthereumLiquidityPool synthereumPool;
    ISynthereumLiquidityPool.RedeemParams redeemParams;
  }

  struct SynthereumExchangeParams {
    ISynthereumLiquidityPool inputSynthereumPool;
    ISynthereumLiquidityPool.ExchangeParams exchangeParams;
  }

  /// @notice Performs a ERC20 swap through an OCLR implementation and a mint of a jSynth on a synthereum pool
  /// @param implementationId: identifier of the OCLR implementation to call
  /// @param inputParams: params involving the swap - see RedeemSwapParams struct
  /// @param synthereumPool: synthereum pool address to perform the mint
  /// @param mintParams: params to perform the mint on synthereum
  /// @return returnValues see ReturnValues struct
  function swapAndMint(
    string calldata implementationId,
    SwapMintParams memory inputParams,
    ISynthereumLiquidityPool synthereumPool,
    ISynthereumLiquidityPool.MintParams memory mintParams
  ) external payable returns (ReturnValues memory returnValues);

  /// @notice Performs a synthereum redeem of jSynth into collateral and then a swap through an OCLR implementation
  /// @param implementationId: identifier of the OCLR implementation to call
  /// @param inputParams: params involving the swap - see RedeemSwapParams struct
  /// @param synthereumPool: synthereum pool address to perform the redeem
  /// @param redeemParams: params to perform the mint on synthereum
  /// @param recipient: recipient address of output tokens
  /// @return returnValues see ReturnValues struct
  function redeemAndSwap(
    string calldata implementationId,
    RedeemSwapParams memory inputParams,
    ISynthereumLiquidityPool synthereumPool,
    ISynthereumLiquidityPool.RedeemParams memory redeemParams,
    address recipient
  ) external returns (ReturnValues memory returnValues);

  // flow: unwrap(fixedRate) -> peg jSynth -> toERC20 ? redeemAndSwap(to ERC20 target) : exchange and mint target jSynth;
  // operationArgs : toERC20 ? { redeemParams ; synthereumPool ; redeemSwapParams} : { exchange Params }
  function unwrapFixedRateTo(
    bool toERC20,
    string memory implementationId,
    address targetAsset,
    bytes calldata operationArgs,
    address recipient
  ) external returns (ReturnValues memory returnValues);

  // flow: fromERC20 ? erc20 -> swapAndMint(USDC -> peg jSynth) ->  wrap(pegSynth) : jFiat -> exchange to peg and wrap
  // operationArgs : fromERC20 ? { mintParams, synthereumPool, mintSwapParams} : { exchange Params }
  function wrapFixedRateFrom(
    bool fromERC20,
    string memory implementationId,
    address targetAsset,
    bytes calldata operationArgs,
    address recipient
  ) external returns (ReturnValues memory returnValues);
}
