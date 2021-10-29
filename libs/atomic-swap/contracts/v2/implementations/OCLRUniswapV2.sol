pragma solidity ^0.8.4;
pragma abicoder v2;

import '../BaseOCLR.sol';
import {
  IUniswapV2Router02
} from '@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol';
import {
  IOnChainLiquidityRouter
} from '../interfaces/IOnChainLiquidityRouter.sol';

contract OCLRUniswapV2 is BaseOCLR {
  using SafeERC20 for IERC20;
  using SafeMath for uint256;

  struct ImplementationInfo {
    address routerAddress;
  }

  constructor() IOCLRBase() {}

  receive() external payable {}

  function swapToCollateralAndMint(
    bytes calldata info,
    IOnChainLiquidityRouter.SwapMintParams memory inputParams,
    IOnChainLiquidityRouter.SynthereumMintParams memory synthereumParams
  )
    external
    payable
    override
    returns (IOnChainLiquidityRouter.ReturnValues memory returnValues)
  {
    // decode implementation info
    ImplementationInfo memory implementationInfo =
      decodeImplementationInfo(info);

    // instantiate router
    IUniswapV2Router02 router =
      IUniswapV2Router02(implementationInfo.routerAddress);

    // unpack tokenSwapPath from extraParams
    address[] memory tokenSwapPath = decodeExtraParams(inputParams.extraParams);

    IERC20 collateralToken = IERC20(tokenSwapPath[tokenSwapPath.length - 1]);
    IERC20 inputTokenInstance = IERC20(tokenSwapPath[0]);
    {
      require(
        checkSynthereumPool(
          synthereumParams.synthereumFinder,
          synthereumParams.synthereumPool
        ) == collateralToken,
        'Wrong collateral instance'
      );
    }
    bool isEthInput = msg.value > 0;
    returnValues.inputToken = isEthInput
      ? address(0xFFfFfFffFFfffFFfFFfFFFFFffFFFffffFfFFFfF)
      : address(inputTokenInstance);
    returnValues.outputToken = address(
      synthereumParams.synthereumPool.syntheticToken()
    );
    returnValues.collateralToken = address(collateralToken);

    if (inputParams.isExactInput) {
      returnValues.inputAmount = isEthInput
        ? msg.value
        : inputParams.exactAmount;
      if (isEthInput) {
        //swapExactETHForTokens into this wallet
        synthereumParams.mintParams.collateralAmount = router
          .swapExactETHForTokens{value: msg.value}(
          inputParams.minOutOrMaxIn,
          tokenSwapPath,
          address(this),
          synthereumParams.mintParams.expiration
        )[tokenSwapPath.length - 1];
      } else {
        //swapExactTokensForTokens into this wallet
        inputTokenInstance.safeTransferFrom(
          msg.sender,
          address(this),
          inputParams.exactAmount
        );
        inputTokenInstance.safeIncreaseAllowance(
          implementationInfo.routerAddress,
          inputParams.exactAmount
        );
        synthereumParams.mintParams.collateralAmount = router
          .swapExactTokensForTokens(
          inputParams.exactAmount,
          inputParams.minOutOrMaxIn,
          tokenSwapPath,
          address(this),
          synthereumParams.mintParams.expiration
        )[tokenSwapPath.length - 1];
      }
    } else {
      uint256[] memory amountsOut;

      if (isEthInput) {
        //swapETHForExactTokens
        inputParams.minOutOrMaxIn = msg.value;

        // swap to exact collateral
        amountsOut = router.swapETHForExactTokens{value: msg.value}(
          inputParams.exactAmount,
          tokenSwapPath,
          address(this),
          synthereumParams.mintParams.expiration
        );

        // refund eventual eth leftover
        if (inputParams.minOutOrMaxIn > amountsOut[0]) {
          payable(msg.sender).transfer(
            inputParams.minOutOrMaxIn.sub(amountsOut[0])
          );
        }
      } else {
        //swapTokensForExactTokens
        inputTokenInstance.safeTransferFrom(
          msg.sender,
          address(this),
          inputParams.minOutOrMaxIn
        );
        inputTokenInstance.safeIncreaseAllowance(
          implementationInfo.routerAddress,
          inputParams.minOutOrMaxIn
        );

        amountsOut = router.swapTokensForExactTokens(
          inputParams.exactAmount,
          inputParams.minOutOrMaxIn,
          tokenSwapPath,
          address(this),
          synthereumParams.mintParams.expiration
        );

        if (inputParams.minOutOrMaxIn > amountsOut[0]) {
          inputTokenInstance.safeTransfer(
            msg.sender,
            inputParams.minOutOrMaxIn.sub(amountsOut[0])
          );

          // reset allowance
          inputTokenInstance.safeApprove(implementationInfo.routerAddress, 0);
        }
      }

      //return value
      returnValues.inputAmount = amountsOut[0];
      synthereumParams.mintParams.collateralAmount = amountsOut[
        tokenSwapPath.length - 1
      ];
    }

    // mint jSynth with collateral out
    collateralToken.safeIncreaseAllowance(
      address(synthereumParams.synthereumPool),
      synthereumParams.mintParams.collateralAmount
    );

    (returnValues.outputAmount, ) = synthereumParams.synthereumPool.mint(
      synthereumParams.mintParams
    );
  }

  // redeem jSynth into collateral and use that to swap into erc20/eth
  function redeemCollateralAndSwap(
    bytes calldata info,
    IOnChainLiquidityRouter.RedeemSwapParams memory inputParams,
    IOnChainLiquidityRouter.SynthereumRedeemParams memory synthereumParams,
    address recipient
  )
    external
    override
    returns (IOnChainLiquidityRouter.ReturnValues memory returnValues)
  {
    // decode implementation info
    ImplementationInfo memory implementationInfo =
      decodeImplementationInfo(info);

    // instantiate router
    IUniswapV2Router02 router =
      IUniswapV2Router02(implementationInfo.routerAddress);

    // unpack tokenSwapPath from extraParams
    address[] memory tokenSwapPath = decodeExtraParams(inputParams.extraParams);

    // check pool
    require(
      address(
        checkSynthereumPool(
          synthereumParams.synthereumFinder,
          synthereumParams.synthereumPool
        )
      ) == tokenSwapPath[0],
      'Wrong collateral instance'
    );
    address outputTokenAddress = tokenSwapPath[tokenSwapPath.length - 1];

    IERC20 synthTokenInstance =
      synthereumParams.synthereumPool.syntheticToken();

    // redeem USDC with jSynth into this contract
    synthTokenInstance.safeTransferFrom(
      msg.sender,
      address(this),
      synthereumParams.redeemParams.numTokens
    );
    synthTokenInstance.safeIncreaseAllowance(
      address(synthereumParams.synthereumPool),
      synthereumParams.redeemParams.numTokens
    );

    returnValues.inputToken = address(synthTokenInstance);
    returnValues.outputToken = inputParams.unwrapToETH
      ? address(0xFFfFfFffFFfffFFfFFfFFFFFffFFFffffFfFFFfF)
      : outputTokenAddress;
    returnValues.collateralToken = tokenSwapPath[0];
    returnValues.inputAmount = synthereumParams.redeemParams.numTokens;

    // redeem to collateral and approve swap
    synthereumParams.redeemParams.recipient = address(this);
    (uint256 collateralOut, ) =
      synthereumParams.synthereumPool.redeem(synthereumParams.redeemParams);

    // allow router to swap tokens
    IERC20(tokenSwapPath[0]).safeIncreaseAllowance(
      implementationInfo.routerAddress,
      collateralOut
    );
    uint256[] memory amountsOut;

    if (inputParams.isExactInput) {
      // collateralOut as exactInput
      inputParams.unwrapToETH
        ? amountsOut = router.swapExactTokensForETH(
          collateralOut,
          inputParams.minOutOrMaxIn,
          tokenSwapPath,
          recipient,
          synthereumParams.redeemParams.expiration
        )
        : amountsOut = router.swapExactTokensForTokens(
        collateralOut,
        inputParams.minOutOrMaxIn,
        tokenSwapPath,
        recipient,
        synthereumParams.redeemParams.expiration
      );
    } else {
      // collateralOut as maxInput
      inputParams.unwrapToETH
        ? amountsOut = router.swapTokensForExactETH(
          inputParams.exactAmount,
          collateralOut,
          tokenSwapPath,
          recipient,
          synthereumParams.redeemParams.expiration
        )
        : amountsOut = router.swapTokensForExactTokens(
        inputParams.exactAmount,
        collateralOut,
        tokenSwapPath,
        recipient,
        synthereumParams.redeemParams.expiration
      );

      // eventual collateral refund
      if (collateralOut > amountsOut[0]) {
        uint256 collateralRefund = collateralOut.sub(amountsOut[0]);

        IERC20(tokenSwapPath[0]).safeTransfer(msg.sender, collateralRefund);

        // reset router allowance
        IERC20(tokenSwapPath[0]).safeApprove(
          implementationInfo.routerAddress,
          0
        );

        // return value
        returnValues.collateralAmountRefunded = collateralRefund;
      }
    }

    // store second return value - output token amount
    returnValues.outputAmount = amountsOut[tokenSwapPath.length - 1];
  }

  function decodeImplementationInfo(bytes calldata info)
    internal
    pure
    returns (ImplementationInfo memory)
  {
    return abi.decode(info, (ImplementationInfo));
  }

  function decodeExtraParams(bytes memory params)
    internal
    pure
    returns (address[] memory)
  {
    return abi.decode(params, (address[]));
  }
}
