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
    address synthereumFinder;
  }

  constructor() BaseAtomicSwap() {}

  receive() external payable {}

  /// @return returnValues = [inputToken, outputToken, inputAmount, outputAmount]
  function swapToCollateralAndMint(
    bytes calldata info,
    IAtomicSwapProxy.SwapMintParams memory inputParams,
    ISynthereumPoolOnChainPriceFeed synthereumPool,
    ISynthereumPoolOnChainPriceFeed.MintParams memory mintParams
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
          implementationInfo.synthereumFinder,
          synthereumPool
        ) == collateralToken,
        'Wrong collateral instance'
      );
    }

    returnValues.inputToken = address(tokenSwapPath[0]);
    returnValues.outputToken = address(synthereumPool.syntheticToken());

    bool isEthInput = msg.value > 0;
    // swap to collateral token (exact[input/output][ETH/ERC20])
    if (inputParams.isExactInput) {
      returnValues.inputAmount = isEthInput
        ? msg.value
        : inputParams.exactAmount;
      if (isEthInput) {
        // swapExactETHForTokens
        mintParams.collateralAmount = kyberRouter.swapExactETHForTokens{
          value: msg.value
        }(
          inputParams.minOutOrMaxIn,
          poolsPath,
          tokenSwapPath,
          address(this),
          mintParams.expiration
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
        mintParams.collateralAmount = kyberRouter.swapExactTokensForTokens(
          inputParams.exactAmount,
          inputParams.minOutOrMaxIn,
          poolsPath,
          tokenSwapPath,
          address(this),
          mintParams.expiration
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
          mintParams.expiration
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
          mintParams.expiration
        );

        if (inputParams.minOutOrMaxIn > amountsOut[0]) {
          // refund leftover input erc20
          tokenSwapPath[0].safeTransfer(
            msg.sender,
            inputParams.minOutOrMaxIn.sub(amountsOut[0])
          );
        }
        // reset allowance
        tokenSwapPath[0].safeApprove(implementationInfo.routerAddress, 0);
      }

      //return value
      returnValues.inputAmount = amountsOut[0];
      mintParams.collateralAmount = amountsOut[tokenSwapPath.length - 1];
    }

    // approve synthereum to pull collateral
    collateralToken.safeIncreaseAllowance(
      address(synthereumPool),
      mintParams.collateralAmount
    );

    // mint jSynth to mintParams.recipient (supposedly msg.sender)
    // returns the output amount
    (returnValues.outputAmount, ) = synthereumPool.mint(mintParams);

    // reset allowance
    collateralToken.safeApprove(address(synthereumPool), 0);
  }

  // redeem jSynth into collateral and use that to swap into erc20/eth
  function redeemCollateralAndSwap(
    bytes calldata info,
    IAtomicSwapProxy.RedeemSwapParams memory inputParams,
    ISynthereumPoolOnChainPriceFeed synthereumPool,
    ISynthereumPoolOnChainPriceFeed.RedeemParams memory redeemParams,
    address recipient
  ) external override returns (IAtomicSwapProxy.ReturnValues memory) {
    // decode implementation info
    ImplementationInfo memory implementationInfo =
      decodeImplementationInfo(info);

    // unpack the extraParams
    (address[] memory poolsPath, IERC20[] memory tokenSwapPath) =
      decodeExtraParams(inputParams.extraParams);

    // checks
    require(
      poolsPath.length == tokenSwapPath.length - 1,
      'Pools and tokens length mismatch'
    );
    require(
      checkSynthereumPool(
        implementationInfo.synthereumFinder,
        synthereumPool
      ) == tokenSwapPath[0],
      'Wrong collateral instance'
    );

    {
      IERC20 synthTokenInstance = synthereumPool.syntheticToken();

      // redeem USDC with jSynth into this contract
      synthTokenInstance.safeTransferFrom(
        msg.sender,
        address(this),
        redeemParams.numTokens
      );
      synthTokenInstance.safeIncreaseAllowance(
        address(synthereumPool),
        redeemParams.numTokens
      );
    }
    // redeem to collateral and approve swap
    redeemParams.recipient = address(this);
    (uint256 collateralOut, ) = synthereumPool.redeem(redeemParams);

    // approve kyber router to swap tokens
    tokenSwapPath[0].safeIncreaseAllowance(
      implementationInfo.routerAddress,
      collateralOut
    );

    uint256[] memory amountsOut;
    if (inputParams.isExactInput) {
      // insantiate router
      IDMMExchangeRouter kyberRouter =
        IDMMExchangeRouter(implementationInfo.routerAddress);

      // collateralOut as exactInput
      inputParams.unwrapToETH
        ? amountsOut = kyberRouter.swapExactTokensForETH(
          collateralOut,
          inputParams.minOutOrMaxIn,
          poolsPath,
          tokenSwapPath,
          recipient,
          redeemParams.expiration
        )
        : amountsOut = kyberRouter.swapExactTokensForTokens(
        collateralOut,
        inputParams.minOutOrMaxIn,
        poolsPath,
        tokenSwapPath,
        recipient,
        redeemParams.expiration
      );
    } else {
      // insantiate router
      IDMMExchangeRouter kyberRouter =
        IDMMExchangeRouter(implementationInfo.routerAddress);
      // collateralOut as maxInput
      inputParams.unwrapToETH
        ? amountsOut = kyberRouter.swapTokensForExactETH(
          inputParams.exactAmount,
          collateralOut,
          poolsPath,
          tokenSwapPath,
          recipient,
          redeemParams.expiration
        )
        : amountsOut = kyberRouter.swapTokensForExactTokens(
        inputParams.exactAmount,
        collateralOut,
        poolsPath,
        tokenSwapPath,
        recipient,
        redeemParams.expiration
      );

      // eventual collateral refund
      if (collateralOut > amountsOut[0]) {
        tokenSwapPath[0].safeTransfer(
          msg.sender,
          collateralOut.sub(amountsOut[0])
        );
      }
    }

    // reset router allowance
    tokenSwapPath[0].safeApprove(implementationInfo.routerAddress, 0);

    // reset pool allowance
    synthereumPool.syntheticToken().safeApprove(address(synthereumPool), 0);

    return
      IAtomicSwapProxy.ReturnValues(
        address(synthereumPool.syntheticToken()),
        address(tokenSwapPath[tokenSwapPath.length - 1]),
        redeemParams.numTokens,
        amountsOut[tokenSwapPath.length - 1]
      );
    // store second return value - output token amount
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
