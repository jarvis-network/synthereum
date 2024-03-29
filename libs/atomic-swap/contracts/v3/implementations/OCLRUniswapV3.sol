// SPDX-License-Identifier: MIT

pragma solidity 0.8.9;

import {ISwapRouter} from '@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol';
import {IPeripheryPayments} from '@uniswap/v3-periphery/contracts/interfaces/IPeripheryPayments.sol';
import {IOnChainLiquidityRouter} from '../interfaces/IOnChainLiquidityRouter.sol';
import {IWETH9} from '../interfaces/IWETH9.sol';
import {OCLRBase, IERC20} from '../OCLRBase.sol';
import {AtomicSwapConstants} from '../lib/AtomicSwapConstants.sol';
import {SafeERC20} from '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';

// group the two univ3 interfaces for convenience
interface IUniswapV3Router is ISwapRouter, IPeripheryPayments {
  function WETH9() external returns (address);
}

contract OCLRV2UniswapV3 is OCLRBase {
  using SafeERC20 for IERC20;

  struct ImplementationInfo {
    address routerAddress;
  }

  constructor() OCLRBase() {}

  /// see IBase.sol
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
    ImplementationInfo memory implementationInfo = decodeImplementationInfo(
      info
    );

    // instantiate router
    IUniswapV3Router router = IUniswapV3Router(
      implementationInfo.routerAddress
    );

    // unpack the extraParams
    (uint24[] memory fees, address[] memory tokenSwapPath) = decodeExtraParams(
      inputParams.extraParams
    );

    IERC20 collateralToken = IERC20(tokenSwapPath[tokenSwapPath.length - 1]);
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
      ? address(AtomicSwapConstants.ETH_ADDR)
      : tokenSwapPath[0];
    returnValues.outputToken = address(
      synthereumParams.synthereumPool.syntheticToken()
    );
    returnValues.collateralToken = address(collateralToken);

    if (inputParams.isExactInput) {
      if (isEthInput) {
        // eth as input
        inputParams.exactAmount = msg.value;
        returnValues.inputAmount = msg.value;
      } else {
        // erc20 as input
        // get input funds from caller
        IERC20(tokenSwapPath[0]).safeTransferFrom(
          inputParams.msgSender,
          address(this),
          inputParams.exactAmount
        );

        //approve router to swap tokens
        IERC20(tokenSwapPath[0]).safeIncreaseAllowance(
          implementationInfo.routerAddress,
          inputParams.exactAmount
        );
        returnValues.inputAmount = inputParams.exactAmount;
      }

      // swap to collateral token into this wallet
      ISwapRouter.ExactInputParams memory params = ISwapRouter
        .ExactInputParams({
        path: encodeAddresses(inputParams.isExactInput, tokenSwapPath, fees),
        recipient: address(this),
        deadline: synthereumParams.mintParams.expiration,
        amountIn: inputParams.exactAmount,
        amountOutMinimum: inputParams.minOutOrMaxIn
      });

      synthereumParams.mintParams.collateralAmount = router.exactInput{
        value: msg.value
      }(params);

      // approve synthereum to pull collateral
      collateralToken.safeIncreaseAllowance(
        address(synthereumParams.synthereumPool),
        synthereumParams.mintParams.collateralAmount
      );

      // mint jSynth to mintParams.recipient (supposedly inputParams.msgSender)
      // returns the output amount
      (returnValues.outputAmount, ) = synthereumParams.synthereumPool.mint(
        synthereumParams.mintParams
      );
    } else {
      // exact output (collateral)
      if (isEthInput) {
        // max eth as input
        inputParams.minOutOrMaxIn = msg.value;
      } else {
        // max erc20 as input
        // pull the max input tokens allowed to spend
        IERC20(tokenSwapPath[0]).safeTransferFrom(
          inputParams.msgSender,
          address(this),
          inputParams.minOutOrMaxIn
        );

        // approve router to swap tokens
        IERC20(tokenSwapPath[0]).safeIncreaseAllowance(
          implementationInfo.routerAddress,
          inputParams.minOutOrMaxIn
        );
      }

      // swap to collateral token into this wallet
      ISwapRouter.ExactOutputParams memory params = ISwapRouter
        .ExactOutputParams({
        path: encodeAddresses(inputParams.isExactInput, tokenSwapPath, fees),
        recipient: address(this),
        deadline: synthereumParams.mintParams.expiration,
        amountOut: inputParams.exactAmount,
        amountInMaximum: inputParams.minOutOrMaxIn
      });

      returnValues.inputAmount = router.exactOutput{value: msg.value}(params);

      // refund leftover tokens
      if (inputParams.minOutOrMaxIn > returnValues.inputAmount) {
        if (isEthInput) {
          // refund extra eth to user - the univ3 router refunds all his eth balance
          uint256 routerETHBalance = address(implementationInfo.routerAddress)
            .balance;
          returnValues.inputAmount = inputParams.minOutOrMaxIn >
            routerETHBalance
            ? inputParams.minOutOrMaxIn - routerETHBalance
            : 0;
          router.refundETH();

          (bool success, ) = inputParams.msgSender.call{
            value: routerETHBalance
          }('');
          require(success, 'Failed eth refund');
        } else {
          // refund erc20
          IERC20(tokenSwapPath[0]).safeTransfer(
            inputParams.msgSender,
            inputParams.minOutOrMaxIn - returnValues.inputAmount
          );

          // reset router allowance
          IERC20(tokenSwapPath[0]).safeApprove(
            implementationInfo.routerAddress,
            0
          );
        }
      }

      // approve synthereum to pull collateral
      collateralToken.safeIncreaseAllowance(
        address(synthereumParams.synthereumPool),
        inputParams.exactAmount
      );

      // mint jSynth to mintParams.recipient (supposedly inputParams.msgSender)
      // returns the output amount
      synthereumParams.mintParams.collateralAmount = inputParams.exactAmount;
      (returnValues.outputAmount, ) = synthereumParams.synthereumPool.mint(
        synthereumParams.mintParams
      );
    }
  }

  /// see IBase.sol
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
    ImplementationInfo memory implementationInfo = decodeImplementationInfo(
      info
    );

    // unpack the extraParams
    (uint24[] memory fees, address[] memory tokenSwapPath) = decodeExtraParams(
      inputParams.extraParams
    );

    IERC20 synthTokenInstance = synthereumParams
      .synthereumPool
      .syntheticToken();
    IERC20 collateralInstance = IERC20(tokenSwapPath[0]);
    {
      require(
        checkSynthereumPool(
          synthereumParams.synthereumFinder,
          synthereumParams.synthereumPool
        ) == collateralInstance,
        'Wrong collateral instance'
      );
      // redeem USDC with jSynth into this contract
      synthTokenInstance.safeTransferFrom(
        inputParams.msgSender,
        address(this),
        synthereumParams.redeemParams.numTokens
      );
      synthTokenInstance.safeIncreaseAllowance(
        address(synthereumParams.synthereumPool),
        synthereumParams.redeemParams.numTokens
      );

      // store return values
      returnValues.inputToken = address(synthTokenInstance);
      returnValues.outputToken = inputParams.unwrapToETH
        ? address(AtomicSwapConstants.ETH_ADDR)
        : tokenSwapPath[tokenSwapPath.length - 1];
      returnValues.collateralToken = tokenSwapPath[0];
      returnValues.inputAmount = synthereumParams.redeemParams.numTokens;

      synthereumParams.redeemParams.recipient = address(this);
      inputParams.isExactInput
        ? (inputParams.exactAmount, ) = synthereumParams.synthereumPool.redeem(
          synthereumParams.redeemParams
        )
        : (inputParams.minOutOrMaxIn, ) = synthereumParams
        .synthereumPool
        .redeem(synthereumParams.redeemParams);

      collateralInstance.safeIncreaseAllowance(
        implementationInfo.routerAddress,
        inputParams.isExactInput
          ? inputParams.exactAmount
          : inputParams.minOutOrMaxIn
      );
    }

    address swapRecipient = inputParams.unwrapToETH
      ? implementationInfo.routerAddress
      : recipient;
    if (inputParams.isExactInput) {
      // collateral as exact input
      // swap to erc20 token (into recipient or swap router wallet)
      ISwapRouter.ExactInputParams memory params = ISwapRouter.ExactInputParams(
        encodeAddresses(inputParams.isExactInput, tokenSwapPath, fees),
        swapRecipient,
        synthereumParams.redeemParams.expiration,
        inputParams.exactAmount,
        inputParams.minOutOrMaxIn
      );

      returnValues.outputAmount = IUniswapV3Router(
        implementationInfo.routerAddress
      ).exactInput(params);

      if (inputParams.unwrapToETH) {
        // the univ3 router unwraps all the WETH balance it has, which can be higher that outputAmount
        returnValues.outputAmount = IWETH9(
          IUniswapV3Router(implementationInfo.routerAddress).WETH9()
        ).balanceOf(implementationInfo.routerAddress);

        // unwrap to ETH
        IUniswapV3Router(implementationInfo.routerAddress).unwrapWETH9(
          returnValues.outputAmount,
          recipient
        );
      }
    } else {
      ISwapRouter.ExactOutputParams memory params = ISwapRouter
        .ExactOutputParams(
        encodeAddresses(inputParams.isExactInput, tokenSwapPath, fees),
        swapRecipient,
        synthereumParams.redeemParams.expiration,
        inputParams.exactAmount,
        inputParams.minOutOrMaxIn
      );
      {
        uint256 inputTokensUsed = IUniswapV3Router(
          implementationInfo.routerAddress
        ).exactOutput(params);

        // refund leftover input (collateral) tokens
        if (inputParams.minOutOrMaxIn > inputTokensUsed) {
          uint256 collateralRefund = inputParams.minOutOrMaxIn -
            inputTokensUsed;

          IERC20(tokenSwapPath[0]).safeTransfer(
            inputParams.msgSender,
            collateralRefund
          );

          // reset router allowance
          collateralInstance.safeApprove(implementationInfo.routerAddress, 0);

          // return value
          returnValues.collateralAmountRefunded = collateralRefund;
        }

        if (inputParams.unwrapToETH) {
          // the univ3 router unwraps all the WETH balance it has, which can be higher than exact output
          returnValues.outputAmount = IWETH9(
            IUniswapV3Router(implementationInfo.routerAddress).WETH9()
          ).balanceOf(implementationInfo.routerAddress);
          //unwrap to eth
          IUniswapV3Router(implementationInfo.routerAddress).unwrapWETH9(
            returnValues.outputAmount,
            recipient
          );
        } else {
          returnValues.outputAmount = inputParams.exactAmount;
        }
      }
    }
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
    returns (uint24[] memory, address[] memory)
  {
    return abi.decode(params, (uint24[], address[]));
  }

  // generates the encoded bytes for multihop swap
  function encodeAddresses(
    bool isExactInput,
    address[] memory addresses,
    uint24[] memory fees
  ) internal pure returns (bytes memory data) {
    /// ie 3 tokens 2 pools
    require(
      addresses.length == fees.length + 1,
      'Mismatch between tokens and fees'
    );

    if (isExactInput) {
      // path encoded from first to last token and fee
      for (uint256 i = 0; i < addresses.length - 1; i++) {
        data = abi.encodePacked(data, addresses[i], fees[i]);
      }

      // last token
      data = abi.encodePacked(data, addresses[addresses.length - 1]);
    } else {
      // path encoded from last to first token and fee
      for (uint256 i = addresses.length - 1; i > 0; i--) {
        data = abi.encodePacked(data, addresses[i], fees[i - 1]);
      }
      // last token
      data = abi.encodePacked(data, addresses[0]);
    }
  }
}
