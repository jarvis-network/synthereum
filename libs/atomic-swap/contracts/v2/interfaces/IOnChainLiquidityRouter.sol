pragma solidity ^0.8.4;

import {
  ISynthereumPoolOnChainPriceFeed
} from '@jarvis-network/synthereum-contracts/contracts/synthereum-pool/v4/interfaces/IPoolOnChainPriceFeed.sol';

import {
  ISynthereumFinder
} from '@jarvis-network/synthereum-contracts/contracts/core/interfaces/IFinder.sol';

interface IOnChainLiquidityRouter {
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
  }

  // input values for implementation
  struct SwapMintParams {
    bool isExactInput;
    uint256 exactAmount;
    uint256 minOutOrMaxIn;
    bytes extraParams;
  }

  // synthereum variables
  struct SynthereumMintParams {
    ISynthereumFinder synthereumFinder;
    ISynthereumPoolOnChainPriceFeed synthereumPool;
    ISynthereumPoolOnChainPriceFeed.MintParams mintParams;
  }

  // synthereum variables
  struct SynthereumRedeemParams {
    ISynthereumFinder synthereumFinder;
    ISynthereumPoolOnChainPriceFeed synthereumPool;
    ISynthereumPoolOnChainPriceFeed.RedeemParams redeemParams;
  }

  function swapAndMint(
    string calldata implementationId,
    SwapMintParams memory inputParams,
    ISynthereumPoolOnChainPriceFeed synthereumPool,
    ISynthereumPoolOnChainPriceFeed.MintParams memory mintParams
  ) external payable returns (ReturnValues memory returnValues);

  function redeemAndSwap(
    string calldata implementationId,
    RedeemSwapParams memory inputParams,
    ISynthereumPoolOnChainPriceFeed synthereumPool,
    ISynthereumPoolOnChainPriceFeed.RedeemParams memory redeemParams,
    address recipient
  ) external returns (ReturnValues memory returnValue);
}
