// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;
pragma abicoder v2;

import '../BaseAtomicSwap.sol';
import '@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol';

interface IUniswapV3Router is ISwapRouter {
  function refundETH() external payable;
}

contract UniV3AtomicSwap is BaseAtomicSwap {
  using SafeERC20 for IERC20;
  using SafeMath for uint256;

  struct ImplementationInfo {
    address routerAddress;
    address synthereumFinder;
  }

  constructor() BaseAtomicSwap() {}

  receive() external payable {}

  /// @param extraParams is in this case [] of fees of the pools to swap through (abi-encoded)
  function swapToCollateralAndMint(
    bytes calldata info,
    bool isExactInput,
    uint256 exactAmount,
    uint256 minOutOrMaxIn,
    bytes calldata extraParams,
    ISynthereumPoolOnChainPriceFeed synthereumPool,
    ISynthereumPoolOnChainPriceFeed.MintParams memory mintParams
  ) external payable returns (uint256 amountOut) {
    // decode implementation info
    ImplementationInfo memory implementationInfo =
      decodeImplementationInfo(info);

    // instantiate router
    IUniswapV3Router router =
      IUniswapV3Router(implementationInfo.routerAddress);

    // unpack the extraParams
    (uint24[] memory fees, address[] memory tokenSwapPath) =
      decodeExtraParams(extraParams);

    require(
      address(
        checkSynthereumPool(implementationInfo.synthereumFinder, synthereumPool)
      ) == tokenSwapPath[tokenSwapPath.length - 1],
      'Wrong collateral instance'
    );

    if (isExactInput) {
      if (msg.value > 0) {
        // eth as input
        exactAmount = msg.value;
      } else {
        // erc20 as input
        // get input funds from caller
        IERC20(tokenSwapPath[0]).safeTransferFrom(
          msg.sender,
          address(this),
          exactAmount
        );

        //approve router to swap tokens
        IERC20(tokenSwapPath[0]).safeIncreaseAllowance(
          implementationInfo.routerAddress,
          exactAmount
        );
      }

      // swap to collateral token into this wallet
      ISwapRouter.ExactInputParams memory params =
        ISwapRouter.ExactInputParams({
          path: encodeAddresses(isExactInput, tokenSwapPath, fees),
          recipient: address(this),
          deadline: mintParams.expiration,
          amountIn: exactAmount,
          amountOutMinimum: minOutOrMaxIn
        });

      uint256 collateralOut = router.exactInput{value: msg.value}(params);

      // approve synthereum to pull collateral
      IERC20(tokenSwapPath[tokenSwapPath.length - 1]).safeIncreaseAllowance(
        address(synthereumPool),
        collateralOut
      );

      // mint jSynth to mintParams.recipient (supposedly msg.sender)
      // returns the output amount
      mintParams.collateralAmount = collateralOut;
      (amountOut, ) = synthereumPool.mint(mintParams);
    } else {
      // exact output (collateral)
      if (msg.value > 0) {
        // max eth as input
        minOutOrMaxIn = msg.value;
      } else {
        // max erc20 as input
        // pull the max input tokens allowed to spend
        IERC20(tokenSwapPath[0]).safeTransferFrom(
          msg.sender,
          address(this),
          minOutOrMaxIn
        );

        // approve router to swap tokens
        IERC20(tokenSwapPath[0]).safeIncreaseAllowance(
          implementationInfo.routerAddress,
          minOutOrMaxIn
        );
      }

      // swap to collateral token into this wallet
      ISwapRouter.ExactOutputParams memory params =
        ISwapRouter.ExactOutputParams({
          path: encodeAddresses(isExactInput, tokenSwapPath, fees),
          recipient: address(this),
          deadline: mintParams.expiration,
          amountOut: exactAmount,
          amountInMaximum: minOutOrMaxIn
        });

      uint256 inputTokenUsed = router.exactOutput{value: msg.value}(params);

      // refund leftover tokens
      if (minOutOrMaxIn > inputTokenUsed) {
        if (msg.value > 0) {
          // take leftover eth from the router
          router.refundETH();
          //send it to user
          (bool success, ) = msg.sender.call{value: address(this).balance}('');
          require(success, 'Refund eth failed');
        } else {
          // refund erc20
          IERC20(tokenSwapPath[0]).safeTransfer(
            msg.sender,
            minOutOrMaxIn.sub(inputTokenUsed)
          );
        }
      }

      // approve synthereum to pull collateral
      IERC20(tokenSwapPath[tokenSwapPath.length - 1]).safeIncreaseAllowance(
        address(synthereumPool),
        exactAmount
      );

      // mint jSynth to mintParams.recipient (supposedly msg.sender)
      // returns the output amount
      mintParams.collateralAmount = exactAmount;
      (amountOut, ) = synthereumPool.mint(mintParams);
    }
  }

  /// @param extraParams is in this case [] of fees of the pools to swap through (abi-encoded)
  function redeemCollateralAndSwap(
    bytes calldata info,
    bool isExactInput,
    uint256 exactAmount,
    uint256 minOutOrMaxIn,
    bytes calldata extraParams,
    ISynthereumPoolOnChainPriceFeed synthereumPool,
    ISynthereumPoolOnChainPriceFeed.RedeemParams memory redeemParams,
    address payable recipient
  ) external returns (uint256) {
    // decode implementation info
    ImplementationInfo memory implementationInfo =
      decodeImplementationInfo(info);

    // unpack the extraParams
    (uint24[] memory fees, address[] memory tokenSwapPath) =
      decodeExtraParams(extraParams);

    {
      require(
        address(
          checkSynthereumPool(
            implementationInfo.synthereumFinder,
            synthereumPool
          )
        ) == tokenSwapPath[0],
        'Wrong collateral instance'
      );

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

      redeemParams.recipient = address(this);
      isExactInput
        ? (exactAmount, ) = synthereumPool.redeem(redeemParams)
        : (minOutOrMaxIn, ) = synthereumPool.redeem(redeemParams);

      IERC20(tokenSwapPath[0]).safeIncreaseAllowance(
        implementationInfo.routerAddress,
        isExactInput ? exactAmount : minOutOrMaxIn
      );
    }

    if (isExactInput) {
      // collateral as exact input
      // swap to erc20 token into recipient wallet
      ISwapRouter.ExactInputParams memory params =
        ISwapRouter.ExactInputParams(
          encodeAddresses(isExactInput, tokenSwapPath, fees),
          recipient,
          redeemParams.expiration,
          exactAmount,
          minOutOrMaxIn
        );

      return
        IUniswapV3Router(implementationInfo.routerAddress).exactInput(params);
    } else {
      // collateralOut as maxInput
      // swap to erc20 token into recipient wallet
      ISwapRouter.ExactOutputParams memory params =
        ISwapRouter.ExactOutputParams(
          encodeAddresses(isExactInput, tokenSwapPath, fees),
          recipient,
          redeemParams.expiration,
          exactAmount,
          minOutOrMaxIn
        );

      uint256 inputTokensUsed =
        IUniswapV3Router(implementationInfo.routerAddress).exactOutput(params);

      // refund leftover input (collateral) tokens
      if (minOutOrMaxIn > inputTokensUsed) {
        IERC20(tokenSwapPath[0]).safeTransfer(
          msg.sender,
          minOutOrMaxIn.sub(inputTokensUsed)
        );
      }

      return inputTokensUsed;
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
