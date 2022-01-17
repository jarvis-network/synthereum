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
    address targetAsset,
    bytes calldata operationArgs,
    address recipient
  )
    external
    returns (IOnChainLiquidityRouterV2.ReturnValues memory returnValues)
  {
    //reverts if the interface is not implemented
    ISynthereumFixedRateWrapper fixedRateWrapper =
      ISynthereumFixedRateWrapper(targetAsset);

    if (!fromERC20) {
      // jSynth -> pegSynth -> fixedRate
      // decode into exchange params struct
      IOnChainLiquidityRouterV2.SynthereumExchangeParams memory params =
        decodeToExchangeParams(operationArgs);

      // check target asset and pool are compatible
      require(
        checkTargetAddress(
          fixedRateWrapper,
          ISynthereumLiquidityPool(address(params.exchangeParams.destPool))
        ),
        'Pool and jSynth mismatch'
      );

      // perform a pool exchange to with recipient being this contract
      params.exchangeParams.recipient = address(this);
      (uint256 pegSynthAmount, ) =
        ISynthereumLiquidityPool(params.inputSynthereumPool).exchange(
          params.exchangeParams
        );

      // wrap jSynth into fixedRate and send them to final recipient
      returnValues.outputAmount = fixedRateWrapper.wrap(
        pegSynthAmount,
        recipient
      );
    } else {
      // erc20 -> pegSynth (through atomicSwap swapAndMint implementation) -> fixedRate
      // decode into SwapMintPeg params
      IOnChainLiquidityRouterV2.SwapMintPegParams memory params =
        decodeToSwapMintParams(operationArgs);

      // check target address is compatible with the pool
      require(
        checkTargetAddress(fixedRateWrapper, params.mintParams.synthereumPool),
        'Pool and jSynth mismatch'
      );

      // delegate call the implementation swapAndMint with the recipient being this contract
      params.mintParams.mintParams.recipient = address(this);
      IOnChainLiquidityRouterV2.ReturnValues memory outputValues =
        delegateCallSwapAndMint(OCLRImplementation, implementationInfo, params);

      // wrap jSynth into fixedRate and send them to final recipient
      returnValues.outputAmount = fixedRateWrapper.wrap(
        outputValues.outputAmount,
        recipient
      );
    }
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

  function checkTargetAddress(
    ISynthereumFixedRateWrapper fixedRateWrapper,
    ISynthereumLiquidityPool pool
  ) internal view returns (bool) {
    return fixedRateWrapper.collateralToken() == pool.syntheticToken();
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
}
