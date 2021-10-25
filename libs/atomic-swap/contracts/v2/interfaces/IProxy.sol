pragma solidity ^0.8.4;

import {
  ISynthereumPoolOnChainPriceFeed
} from '@jarvis-network/synthereum-contracts/contracts/synthereum-pool/v4/interfaces/IPoolOnChainPriceFeed.sol';

interface IAtomicSwapProxy {
  // Role structure
  struct Roles {
    address admin;
    address[] maintainers;
  }

  // return values from delegate call
  struct ReturnValues {
    address inputToken;
    address outputToken;
    uint256 inputAmount;
    uint256 outputAmount;
  }

  // input values for implementation
  struct RedeemSwapParams {
    bool isExactInput;
    bool unwrapToETH;
    uint256 exactAmount;
    uint256 minOutOrMaxIn;
    bytes extraParams;
  }

  function swapAndMint(
    string calldata implementationId,
    bool isExactInput,
    uint256 exactAmount,
    uint256 minOutOrMaxIn,
    bytes memory extraParams,
    ISynthereumPoolOnChainPriceFeed synthereumPool,
    ISynthereumPoolOnChainPriceFeed.MintParams memory mintParams
  ) external payable returns (uint256[2] memory);

  function redeemCollateralAndSwap(
    string calldata implementationId,
    RedeemSwapParams memory inputParams,
    ISynthereumPoolOnChainPriceFeed synthereumPool,
    ISynthereumPoolOnChainPriceFeed.RedeemParams memory redeemParams,
    address recipient
  ) external returns (uint256[2] memory);
}
