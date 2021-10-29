// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;
pragma abicoder v2;

import '../BaseAtomicSwap.sol';
import '../interfaces/IKyberRouter.sol';
import {IAtomicSwapProxy} from '../interfaces/IProxy.sol';

contract KyberAtomicSwap is BaseAtomicSwap {
  using SafeMath for uint256;
  using SafeERC20 for IERC20;

  struct ImplementationInfo {
    address routerAddress;
  }

  constructor() BaseAtomicSwap() {}

  receive() external payable {}

  /// @return returnValues = [inputToken, outputToken, inputAmount, outputAmount]
  function swapToCollateralAndMint(
    bytes calldata info,
    IAtomicSwapProxy.SwapMintParams memory inputParams,
    IAtomicSwapProxy.SynthereumMintParams memory synthereumParams
  )
    external
    payable
    override
    returns (IAtomicSwapProxy.ReturnValues memory returnValues)
  {
    // decode implementation info
    ImplementationInfo memory implementationInfo =
      decodeImplementationInfo(info);

    // insantiate router
    IDMMExchangeRouter kyberRouter =
      IDMMExchangeRouter(implementationInfo.routerAddress);

    // unpack the extraParams
    (address[] memory poolsPath, IERC20[] memory tokenSwapPath) =
      decodeExtraParams(inputParams.extraParams);

    // checks
    require(
      poolsPath.length == tokenSwapPath.length - 1,
      'Pools and tokens length mismatch'
    );

    IERC20 collateralToken = tokenSwapPath[tokenSwapPath.length - 1];
    {
      require(
        checkSynthereumPool(
          synthereumParams.synthereumFinder,
          synthereumParams.synthereumPool
        ) == collateralToken,
        'Wrong collateral instance'
      );
    }

    returnValues.inputToken = address(tokenSwapPath[0]);
    returnValues.outputToken = address(
      synthereumParams.synthereumPool.syntheticToken()
    );
    returnValues.collateralToken = address(collateralToken);

    bool isEthInput = msg.value > 0;
    // swap to collateral token (exact[input/output][ETH/ERC20])
    if (inputParams.isExactInput) {
      returnValues.inputAmount = isEthInput
        ? msg.value
        : inputParams.exactAmount;
      if (isEthInput) {
        // swapExactETHForTokens
        synthereumParams.mintParams.collateralAmount = kyberRouter
          .swapExactETHForTokens{value: msg.value}(
          inputParams.minOutOrMaxIn,
          poolsPath,
          tokenSwapPath,
          address(this),
          synthereumParams.mintParams.expiration
        )[tokenSwapPath.length - 1];
      } else {
        // swapExactTokensForTokens
        // get funds from caller
        tokenSwapPath[0].safeTransferFrom(
          msg.sender,
          address(this),
          inputParams.exactAmount
        );
        //approve kyber router to swap
        tokenSwapPath[0].safeIncreaseAllowance(
          implementationInfo.routerAddress,
          inputParams.exactAmount
        );

        // swap to collateral token into this wallet
        synthereumParams.mintParams.collateralAmount = kyberRouter
          .swapExactTokensForTokens(
          inputParams.exactAmount,
          inputParams.minOutOrMaxIn,
          poolsPath,
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

        // swap to exact collateral and refund leftover
        amountsOut = kyberRouter.swapETHForExactTokens{value: msg.value}(
          inputParams.exactAmount,
          poolsPath,
          tokenSwapPath,
          address(this),
          synthereumParams.mintParams.expiration
        );

        if (inputParams.minOutOrMaxIn > amountsOut[0]) {
          payable(msg.sender).transfer(
            inputParams.minOutOrMaxIn.sub(amountsOut[0])
          );
        }
      } else {
        //swapTokensForExactTokens
        // pull the max input tokens allowed to spend
        tokenSwapPath[0].safeTransferFrom(
          msg.sender,
          address(this),
          inputParams.minOutOrMaxIn
        );
        //approve kyber router to swap s
        tokenSwapPath[0].safeIncreaseAllowance(
          implementationInfo.routerAddress,
          inputParams.minOutOrMaxIn
        );

        // swap to collateral token into this wallet
        amountsOut = kyberRouter.swapTokensForExactTokens(
          inputParams.exactAmount,
          inputParams.minOutOrMaxIn,
          poolsPath,
          tokenSwapPath,
          address(this),
          synthereumParams.mintParams.expiration
        );

        if (inputParams.minOutOrMaxIn > amountsOut[0]) {
          // refund leftover input erc20
          tokenSwapPath[0].safeTransfer(
            msg.sender,
            inputParams.minOutOrMaxIn.sub(amountsOut[0])
          );

          // reset allowance
          tokenSwapPath[0].safeApprove(implementationInfo.routerAddress, 0);
        }
      }

      //return value
      returnValues.inputAmount = amountsOut[0];
      synthereumParams.mintParams.collateralAmount = amountsOut[
        tokenSwapPath.length - 1
      ];
    }

    // approve synthereum to pull collateral
    collateralToken.safeIncreaseAllowance(
      address(synthereumParams.synthereumPool),
      synthereumParams.mintParams.collateralAmount
    );

    // mint jSynth to mintParams.recipient (supposedly msg.sender)
    // returns the output amount
    (returnValues.outputAmount, ) = synthereumParams.synthereumPool.mint(
      synthereumParams.mintParams
    );
  }

  // redeem jSynth into collateral and use that to swap into erc20/eth
  function redeemCollateralAndSwap(
    bytes calldata info,
    IAtomicSwapProxy.RedeemSwapParams memory inputParams,
    IAtomicSwapProxy.SynthereumRedeemParams memory synthereumParams,
    address recipient
  )
    external
    override
    returns (IAtomicSwapProxy.ReturnValues memory returnValues)
  {
    // decode implementation info
    ImplementationInfo memory implementationInfo =
      decodeImplementationInfo(info);

    // unpack the extraParams
    (address[] memory poolsPath, IERC20[] memory tokenSwapPath) =
      decodeExtraParams(inputParams.extraParams);

    // insantiate router
    IDMMExchangeRouter kyberRouter =
      IDMMExchangeRouter(implementationInfo.routerAddress);

    // checks
    require(
      poolsPath.length == tokenSwapPath.length - 1,
      'Pools and tokens length mismatch'
    );
    require(
      checkSynthereumPool(
        synthereumParams.synthereumFinder,
        synthereumParams.synthereumPool
      ) == tokenSwapPath[0],
      'Wrong collateral instance'
    );

    {
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
    }

    returnValues.outputToken = inputParams.unwrapToETH
      ? address(0xFFfFfFffFFfffFFfFFfFFFFFffFFFffffFfFFFfF)
      : address(tokenSwapPath[tokenSwapPath.length - 1]);
    returnValues.collateralToken = address(tokenSwapPath[0]);
    returnValues.inputAmount = synthereumParams.redeemParams.numTokens;

    // redeem to collateral and approve swap
    synthereumParams.redeemParams.recipient = address(this);
    (uint256 collateralOut, ) =
      synthereumParams.synthereumPool.redeem(synthereumParams.redeemParams);

    // approve kyber router to swap tokens
    tokenSwapPath[0].safeIncreaseAllowance(
      implementationInfo.routerAddress,
      collateralOut
    );

    uint256[] memory amountsOut;
    if (inputParams.isExactInput) {
      // collateralOut as exactInput
      inputParams.unwrapToETH
        ? amountsOut = kyberRouter.swapExactTokensForETH(
          collateralOut,
          inputParams.minOutOrMaxIn,
          poolsPath,
          tokenSwapPath,
          recipient,
          synthereumParams.redeemParams.expiration
        )
        : amountsOut = kyberRouter.swapExactTokensForTokens(
        collateralOut,
        inputParams.minOutOrMaxIn,
        poolsPath,
        tokenSwapPath,
        recipient,
        synthereumParams.redeemParams.expiration
      );
    } else {
      // collateralOut as maxInput
      inputParams.unwrapToETH
        ? amountsOut = kyberRouter.swapTokensForExactETH(
          inputParams.exactAmount,
          collateralOut,
          poolsPath,
          tokenSwapPath,
          recipient,
          synthereumParams.redeemParams.expiration
        )
        : amountsOut = kyberRouter.swapTokensForExactTokens(
        inputParams.exactAmount,
        collateralOut,
        poolsPath,
        tokenSwapPath,
        recipient,
        synthereumParams.redeemParams.expiration
      );

      // eventual collateral refund
      if (collateralOut > amountsOut[0]) {
        uint256 collateralRefund = collateralOut.sub(amountsOut[0]);

        tokenSwapPath[0].safeTransfer(msg.sender, collateralRefund);

        // reset router allowance
        tokenSwapPath[0].safeApprove(implementationInfo.routerAddress, 0);

        // return value
        returnValues.collateralAmountRefunded = collateralRefund;
      }
    }

    // return value
    returnValues.outputAmount = amountsOut[tokenSwapPath.length - 1];
  }

  function decodeImplementationInfo(bytes calldata info)
    internal
    pure
    returns (ImplementationInfo memory)
  {
    return abi.decode(info, (ImplementationInfo));
  }

  // generic function that each AtomicSwap implementation can implement
  // in order to receive extra params
  // extra params are in here the poolsPaths
  function decodeExtraParams(bytes memory params)
    internal
    pure
    returns (address[] memory, IERC20[] memory)
  {
    return abi.decode(params, (address[], IERC20[]));
  }
}
