// SPDX-License-Identifier: MIT

pragma solidity 0.8.9;

import {
  ISynthereumFixedRateWrapper
} from '@jarvis-network/synthereum-contracts/contracts/fixed-rate/v1/interfaces/IFixedRateWrapper.sol';
import {
  ISynthereumLiquidityPool
} from '@jarvis-network/synthereum-contracts/contracts/synthereum-pool/v5/interfaces/ILiquidityPool.sol';
import {
  ISynthereumRegistry
} from '@jarvis-network/synthereum-contracts/contracts/core/registries/interfaces/IRegistry.sol';
import {
  SynthereumInterfaces
} from '@jarvis-network/synthereum-contracts/contracts/core/Constants.sol';
import {
  ISynthereumFinder
} from '@jarvis-network/synthereum-contracts/contracts/core/interfaces/IFinder.sol';
import {Address} from '@openzeppelin/contracts/utils/Address.sol';
import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {
  SafeERC20
} from '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import {IOCLRBase} from '../interfaces/IOCLRBase.sol';
import {
  IOnChainLiquidityRouter
} from '../interfaces/IOnChainLiquidityRouter.sol';

contract FixedRateSwap {
  using Address for address;
  using SafeERC20 for IERC20;

  constructor() {}

  function wrapFrom(
    bool fromERC20,
    address recipient,
    IOnChainLiquidityRouter.FixedRateSwapParams memory fixedRateSwapParams
  )
    external
    returns (IOnChainLiquidityRouter.ReturnValues memory returnValues)
  {
    //reverts if the interface is not implemented
    ISynthereumFixedRateWrapper fixedRateWrapper =
      ISynthereumFixedRateWrapper(fixedRateSwapParams.outputAsset);
    IERC20 pegToken = fixedRateWrapper.collateralToken();
    IERC20 syntheticToken = fixedRateWrapper.syntheticToken();

    if (!fromERC20) {
      // jSynth -> pegSynth -> fixedRate
      // decode into exchange params struct
      IOnChainLiquidityRouter.SynthereumExchangeParams memory params =
        decodeToExchangeParams(fixedRateSwapParams.operationArgs);

      // set finder passed from proxy
      params.synthereumFinder = ISynthereumFinder(
        fixedRateSwapParams.synthereumFinder
      );

      // check target synth and pool are compatible
      checkSynth(
        pegToken,
        ISynthereumLiquidityPool(address(params.exchangeParams.destPool))
      );

      // check pools and fixedRate registries
      checkPoolRegistry(
        ISynthereumLiquidityPool(address(params.exchangeParams.destPool)),
        params.synthereumFinder
      );
      checkPoolRegistry(
        ISynthereumLiquidityPool(address(params.inputSynthereumPool)),
        params.synthereumFinder
      );
      checkFixedRateRegistry(fixedRateWrapper, params.synthereumFinder);

      // pull input jSynth and approve pool
      IERC20 inputSynth = params.inputSynthereumPool.syntheticToken();
      inputSynth.safeTransferFrom(
        fixedRateSwapParams.msgSender,
        address(this),
        params.exchangeParams.numTokens
      );
      inputSynth.safeIncreaseAllowance(
        address(params.inputSynthereumPool),
        params.exchangeParams.numTokens
      );

      // perform a pool exchange to with recipient being this contract
      params.exchangeParams.recipient = address(this);
      (uint256 pegSynthAmount, ) =
        params.inputSynthereumPool.exchange(params.exchangeParams);

      // wrap jSynth into fixedRate and send them to final recipient
      pegToken.safeIncreaseAllowance(address(fixedRateWrapper), pegSynthAmount);
      returnValues.outputAmount = fixedRateWrapper.wrap(
        pegSynthAmount,
        recipient
      );

      // set return values
      returnValues.collateralToken = address(pegToken);
      returnValues.inputToken = address(inputSynth);
      returnValues.inputAmount = params.exchangeParams.numTokens;
      returnValues.outputToken = address(syntheticToken);
    } else {
      // erc20 -> pegSynth-> fixedRate
      // decode into SwapMintPeg params
      IOnChainLiquidityRouter.SwapMintPegParams memory params =
        decodeToSwapMintParams(fixedRateSwapParams.operationArgs);

      // set finder passed from proxy
      params.mintParams.synthereumFinder = ISynthereumFinder(
        fixedRateSwapParams.synthereumFinder
      );

      // check target synth is compatible with the pool
      checkSynth(pegToken, params.mintParams.synthereumPool);

      // check pools and fixedRate registries
      checkPoolRegistry(
        ISynthereumLiquidityPool(address(params.mintParams.synthereumPool)),
        params.mintParams.synthereumFinder
      );
      checkFixedRateRegistry(
        fixedRateWrapper,
        params.mintParams.synthereumFinder
      );

      // set synthetic token recipient as this contract
      params.mintParams.mintParams.recipient = address(this);

      if (
        fixedRateSwapParams.inputAsset ==
        address(params.mintParams.synthereumPool.collateralToken())
      ) {
        // collateral -> peg -> fixedRate
        // pull collateral and approve pool
        uint256 inputAmount = params.mintParams.mintParams.collateralAmount;
        IERC20(fixedRateSwapParams.inputAsset).safeTransferFrom(
          fixedRateSwapParams.msgSender,
          address(this),
          inputAmount
        );
        IERC20(fixedRateSwapParams.inputAsset).safeIncreaseAllowance(
          address(params.mintParams.synthereumPool),
          inputAmount
        );

        // mint directly from the pools the peg synth
        (returnValues.outputAmount, ) = params.mintParams.synthereumPool.mint(
          params.mintParams.mintParams
        );
        returnValues.inputAmount = inputAmount;
        returnValues.inputToken = fixedRateSwapParams.inputAsset;
      } else {
        // erc20 -> collateral -> peg -> fixedRate
        params.swapMintParams.msgSender = fixedRateSwapParams.msgSender;

        returnValues = delegateCallSwapAndMint(
          fixedRateSwapParams.OCLRImplementation,
          fixedRateSwapParams.implementationInfo,
          params
        );
      }

      // wrap jSynth into fixedRate and send them to final recipient
      pegToken.safeIncreaseAllowance(
        address(fixedRateWrapper),
        returnValues.outputAmount
      );
      returnValues.outputAmount = fixedRateWrapper.wrap(
        returnValues.outputAmount,
        recipient
      );

      // set returnValues
      returnValues.outputToken = address(syntheticToken);
      returnValues.collateralToken = address(pegToken);
    }
  }

  function unwrapTo(
    bool toERC20,
    uint256 inputAmount,
    IOnChainLiquidityRouter.FixedRateSwapParams memory fixedRateSwapParams
  )
    external
    returns (IOnChainLiquidityRouter.ReturnValues memory returnValues)
  {
    //reverts if the interface is not implemented
    ISynthereumFixedRateWrapper fixedRateWrapper =
      ISynthereumFixedRateWrapper(fixedRateSwapParams.inputAsset);

    IERC20 pegToken = fixedRateWrapper.collateralToken();
    IERC20 fixedRateToken = fixedRateWrapper.syntheticToken();

    // pull and unwrap fixedRate to jSynth to this contract
    fixedRateToken.safeTransferFrom(
      fixedRateSwapParams.msgSender,
      address(this),
      inputAmount
    );
    fixedRateToken.safeIncreaseAllowance(
      address(fixedRateWrapper),
      inputAmount
    );
    uint256 pegSynthAmountOut =
      fixedRateWrapper.unwrap(inputAmount, address(this));

    if (toERC20) {
      // fixedRate -> pegSynth -> erc20
      // decode params
      IOnChainLiquidityRouter.RedeemPegSwapParams memory params =
        abi.decode(
          fixedRateSwapParams.operationArgs,
          (IOnChainLiquidityRouter.RedeemPegSwapParams)
        );
      ISynthereumLiquidityPool redeemPool = params.redeemParams.synthereumPool;

      // set finder passed from proxy
      params.redeemParams.synthereumFinder = ISynthereumFinder(
        fixedRateSwapParams.synthereumFinder
      );

      // check pegSynth and pool are compatible
      checkSynth(pegToken, redeemPool);

      // check pools and fixedRate registries
      checkPoolRegistry(
        ISynthereumLiquidityPool(address(params.redeemParams.synthereumPool)),
        params.redeemParams.synthereumFinder
      );
      checkFixedRateRegistry(
        fixedRateWrapper,
        params.redeemParams.synthereumFinder
      );

      // set redeem params
      params.redeemParams.redeemParams.numTokens = pegSynthAmountOut;

      if (
        fixedRateSwapParams.outputAsset == address(redeemPool.collateralToken())
      ) {
        // peg -> collateral through pool's redeem
        pegToken.safeIncreaseAllowance(address(redeemPool), pegSynthAmountOut);
        (returnValues.outputAmount, ) = redeemPool.redeem(
          params.redeemParams.redeemParams
        );
        returnValues.outputToken = fixedRateSwapParams.outputAsset;
      } else {
        params.redeemSwapParams.msgSender = address(this);

        // peg -> collateral -> erc20
        // approve AtomicSwap to pull pegSynth
        pegToken.safeIncreaseAllowance(address(this), pegSynthAmountOut);

        // delegate call the implementation redeem and swap with the recipient being the final recipient
        returnValues = delegateCallRedeemSwap(
          fixedRateSwapParams.OCLRImplementation,
          fixedRateSwapParams.implementationInfo,
          params
        );
      }
    } else {
      // fixedRate -> pegSynth -> jSynth via exchange
      // decode params
      IOnChainLiquidityRouter.SynthereumExchangeParams memory params =
        decodeToExchangeParams(fixedRateSwapParams.operationArgs);
      ISynthereumLiquidityPool inputPool = params.inputSynthereumPool;

      // set finder passed from proxy
      params.synthereumFinder = ISynthereumFinder(
        fixedRateSwapParams.synthereumFinder
      );

      // check input synth and pool are compatible
      checkSynth(pegToken, inputPool);
      checkPoolRegistry(
        ISynthereumLiquidityPool(address(params.exchangeParams.destPool)),
        params.synthereumFinder
      );
      checkPoolRegistry(
        ISynthereumLiquidityPool(address(params.inputSynthereumPool)),
        params.synthereumFinder
      );
      checkFixedRateRegistry(fixedRateWrapper, params.synthereumFinder);

      // approve pool
      pegToken.safeIncreaseAllowance(address(inputPool), pegSynthAmountOut);

      // perform a pool exchange to with recipient being the final one
      params.exchangeParams.numTokens = pegSynthAmountOut;
      (returnValues.outputAmount, ) = inputPool.exchange(params.exchangeParams);

      // set return values
      returnValues.outputToken = address(
        params.exchangeParams.destPool.syntheticToken()
      );
    }

    // set return values
    returnValues.collateralToken = address(pegToken);
    returnValues.inputAmount = inputAmount;
    returnValues.inputToken = address(fixedRateToken);
  }

  function decodeToExchangeParams(bytes memory args)
    internal
    pure
    returns (IOnChainLiquidityRouter.SynthereumExchangeParams memory params)
  {
    params = abi.decode(
      args,
      (IOnChainLiquidityRouter.SynthereumExchangeParams)
    );
  }

  function decodeToSwapMintParams(bytes memory args)
    internal
    pure
    returns (IOnChainLiquidityRouter.SwapMintPegParams memory params)
  {
    params = abi.decode(args, (IOnChainLiquidityRouter.SwapMintPegParams));
  }

  function checkSynth(IERC20 synth, ISynthereumLiquidityPool pool)
    internal
    view
  {
    require(synth == pool.syntheticToken(), 'Pool and jSynth mismatch');
  }

  function checkPoolRegistry(
    ISynthereumLiquidityPool pool,
    ISynthereumFinder finder
  ) internal view {
    ISynthereumRegistry poolRegistry =
      ISynthereumRegistry(
        finder.getImplementationAddress(SynthereumInterfaces.PoolRegistry)
      );
    require(
      poolRegistry.isDeployed(
        pool.syntheticTokenSymbol(),
        pool.collateralToken(),
        pool.version(),
        address(pool)
      ),
      'Pool not registered'
    );
  }

  function checkFixedRateRegistry(
    ISynthereumFixedRateWrapper fixedRateToken,
    ISynthereumFinder finder
  ) internal view {
    ISynthereumRegistry fixedRateRegitry =
      ISynthereumRegistry(
        finder.getImplementationAddress(SynthereumInterfaces.FixedRateRegistry)
      );
    require(
      fixedRateRegitry.isDeployed(
        fixedRateToken.syntheticTokenSymbol(),
        fixedRateToken.collateralToken(),
        fixedRateToken.version(),
        address(fixedRateToken)
      ),
      'Fixed rate not registered'
    );
  }

  function delegateCallSwapAndMint(
    address implementation,
    bytes memory implementationInfo,
    IOnChainLiquidityRouter.SwapMintPegParams memory params
  )
    internal
    returns (IOnChainLiquidityRouter.ReturnValues memory returnValues)
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

    returnValues = abi.decode(result, (IOnChainLiquidityRouter.ReturnValues));
  }

  function delegateCallRedeemSwap(
    address implementation,
    bytes memory implementationInfo,
    IOnChainLiquidityRouter.RedeemPegSwapParams memory params
  )
    internal
    returns (IOnChainLiquidityRouter.ReturnValues memory returnValues)
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

    returnValues = abi.decode(result, (IOnChainLiquidityRouter.ReturnValues));
  }
}
