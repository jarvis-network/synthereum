// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;
pragma abicoder v2;

import {
  ISynthereumFixedRateWrapper
} from '@jarvis-network/synthereum-contracts/contracts/fixed-rate/v1/interfaces/IFixedRateWrapper.sol';
import {
  ISynthereumLiquidityPool
} from '@jarvis-network/synthereum-contracts/contracts/synthereum-pool/v5/interfaces/ILiquidityPool.sol';
import {Address} from '@openzeppelin/contracts/utils/Address.sol';
import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {IOCLRBase} from '../interfaces/IOCLRBase.sol';
import {
  IOnChainLiquidityRouterV2
} from '../interfaces/IOnChainLiquidityRouter.sol';

contract FixedRateSwap {
  using Address for address;

  function wrapFrom(
    bool fromERC20,
    address OCLRImplementation,
    bytes memory implementationInfo,
    address outputAsset,
    bytes calldata operationArgs,
    address recipient
  )
    external
    returns (IOnChainLiquidityRouterV2.ReturnValues memory returnValues)
  {
    //reverts if the interface is not implemented
    ISynthereumFixedRateWrapper fixedRateWrapper =
      ISynthereumFixedRateWrapper(outputAsset);

    if (!fromERC20) {
      // jSynth -> pegSynth -> fixedRate
      // decode into exchange params struct
      IOnChainLiquidityRouterV2.SynthereumExchangeParams memory params =
        decodeToExchangeParams(operationArgs);

      // check target synth and pool are compatible
      require(
        checkSynth(
          fixedRateWrapper.collateralToken(),
          ISynthereumLiquidityPool(address(params.exchangeParams.destPool))
        ),
        'Pool and jSynth mismatch'
      );

      // perform a pool exchange to with recipient being this contract
      params.exchangeParams.recipient = address(this);
      (uint256 pegSynthAmount, ) =
        params.inputSynthereumPool.exchange(params.exchangeParams);

      // wrap jSynth into fixedRate and send them to final recipient
      returnValues.outputAmount = fixedRateWrapper.wrap(
        pegSynthAmount,
        recipient
      );
      returnValues.inputToken = address(
        params.inputSynthereumPool.syntheticToken()
      );
      returnValues.inputAmount = params.exchangeParams.numTokens;
      returnValues.outputToken = outputAsset;
    } else {
      // erc20 -> pegSynth (through atomicSwap swapAndMint implementation) -> fixedRate
      // decode into SwapMintPeg params
      IOnChainLiquidityRouterV2.SwapMintPegParams memory params =
        decodeToSwapMintParams(operationArgs);

      // check target synth is compatible with the pool
      require(
        checkSynth(
          fixedRateWrapper.collateralToken(),
          params.mintParams.synthereumPool
        ),
        'Pool and jSynth mismatch'
      );

      // delegate call the implementation swapAndMint with the recipient being this contract
      params.mintParams.mintParams.recipient = address(this);
      returnValues = delegateCallSwapAndMint(
        OCLRImplementation,
        implementationInfo,
        params
      );

      // wrap jSynth into fixedRate and send them to final recipient
      returnValues.outputAmount = fixedRateWrapper.wrap(
        returnValues.outputAmount,
        recipient
      );
    }
  }

  function unwrapTo(
    bool toERC20,
    address OCLRImplementation,
    bytes memory implementationInfo,
    uint256 inputAmount,
    address inputAsset,
    bytes calldata operationArgs
  )
    external
    returns (IOnChainLiquidityRouterV2.ReturnValues memory returnValues)
  {
    //reverts if the interface is not implemented
    ISynthereumFixedRateWrapper fixedRateWrapper =
      ISynthereumFixedRateWrapper(inputAsset);

    // unwrap to jSynth to this contract
    fixedRateWrapper.unwrap(inputAmount, address(this));

    if (toERC20) {
      // fixedRte -> pegSynth -> erc20 (through redeemAndSwap)
      // decode params
      IOnChainLiquidityRouterV2.RedeemPegSwapParams memory params =
        abi.decode(
          operationArgs,
          (IOnChainLiquidityRouterV2.RedeemPegSwapParams)
        );

      // check pegSynth and pool are compatible
      require(
        checkSynth(
          fixedRateWrapper.collateralToken(),
          params.redeemParams.synthereumPool
        ),
        'Pool and jSynth mismatch'
      );

      // delegate call the implementation swapAndMint with the recipient being the final recipient
      returnValues = delegateCallRedeemSwap(
        OCLRImplementation,
        implementationInfo,
        params
      );
    } else {
      // fixedRate -> pegSynth -> jSynth via exchange
      // decode params
      IOnChainLiquidityRouterV2.SynthereumExchangeParams memory params =
        decodeToExchangeParams(operationArgs);

      // check input synth and pool are compatible
      require(
        checkSynth(
          fixedRateWrapper.collateralToken(),
          params.inputSynthereumPool
        ),
        'Pool and jSynth mismatch'
      );

      // perform a pool exchange to with recipient being the final one
      (returnValues.outputAmount, ) = params.inputSynthereumPool.exchange(
        params.exchangeParams
      );
    }

    returnValues.inputAmount = inputAmount;
    returnValues.inputToken = inputAsset;
  }

  function decodeToExchangeParams(bytes memory args)
    internal
    pure
    returns (IOnChainLiquidityRouterV2.SynthereumExchangeParams memory params)
  {
    params = abi.decode(
      args,
      (IOnChainLiquidityRouterV2.SynthereumExchangeParams)
    );
  }

  function decodeToSwapMintParams(bytes memory args)
    internal
    pure
    returns (IOnChainLiquidityRouterV2.SwapMintPegParams memory params)
  {
    params = abi.decode(args, (IOnChainLiquidityRouterV2.SwapMintPegParams));
  }

  function checkSynth(IERC20 synth, ISynthereumLiquidityPool pool)
    internal
    view
    returns (bool)
  {
    return synth == pool.syntheticToken();
  }

  function delegateCallSwapAndMint(
    address implementation,
    bytes memory implementationInfo,
    IOnChainLiquidityRouterV2.SwapMintPegParams memory params
  )
    internal
    returns (IOnChainLiquidityRouterV2.ReturnValues memory returnValues)
  {
    string memory functionSig =
      'swapToCollateralAndMint(bytes,(bool,uint256,uint256,bytes,address),(address,address,(uint256,uint256,uint256,address)))';

    bytes memory result =
      implementation.functionDelegateCall(
        abi.encodeWithSignature(
          functionSig,
          implementationInfo,
          params.swapMintParams,
          params.mintParams
        )
      );

    returnValues = abi.decode(result, (IOnChainLiquidityRouterV2.ReturnValues));
  }

  function delegateCallRedeemSwap(
    address implementation,
    bytes memory implementationInfo,
    IOnChainLiquidityRouterV2.RedeemPegSwapParams memory params
  )
    internal
    returns (IOnChainLiquidityRouterV2.ReturnValues memory returnValues)
  {
    string memory functionSig =
      'redeemCollateralAndSwap(bytes,(bool,bool,uint256,uint256,bytes,address),(address,address,(uint256,uint256,uint256,address)),address)';

    bytes memory result =
      implementation.functionDelegateCall(
        abi.encodeWithSignature(
          functionSig,
          implementationInfo,
          params.redeemSwapParams,
          params.redeemParams,
          params.recipient
        )
      );

    returnValues = abi.decode(result, (IOnChainLiquidityRouterV2.ReturnValues));
  }
}
