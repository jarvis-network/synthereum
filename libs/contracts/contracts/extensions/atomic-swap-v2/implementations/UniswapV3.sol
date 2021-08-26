// SPDX-License-Identifier: MIT

pragma solidity >=0.7.5;
pragma abicoder v2;

import '../BaseAtomicSwap.sol';
import '@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol';

interface IUniswapV3Router is ISwapRouter {
  function refundETH() external payable;
}

contract UniV3AtomicSwap is BaseAtomicSwap {
  IUniswapV3Router public router;

  constructor(
    ISynthereumFinder _synthereum,
    IUniswapV3Router _uniV3Router,
    address _wethAddress
  ) BaseAtomicSwap(_wethAddress, _synthereum) {
    router = _uniV3Router;
  }

  receive() external payable {}

  /// @param extraParams is in this case [] of fees of the pools to swap through (abi-encoded)
  function swapToCollateralAndMint(
    bool isExactInput,
    uint256 exactAmount,
    uint256 minOutOrMaxIn,
    address[] memory tokenSwapPath,
    bytes memory extraParams,
    ISynthereumPoolOnChainPriceFeed synthereumPool,
    ISynthereumPoolOnChainPriceFeed.MintParams memory mintParams
  ) external payable returns (uint256 amountOut) {
    // unpack the extraParams
    uint24[] memory fees = decodeExtraParams(extraParams);

    IERC20 collateralInstance = checkSynthereumPool(synthereumPool);
    require(
      address(collateralInstance) == tokenSwapPath[tokenSwapPath.length - 1],
      'Wrong collateral instance'
    );
    IERC20 inputTokenInstance = IERC20(tokenSwapPath[0]);

    // unpack the extraParams (fees) and encode the paths
    uint24[] memory fees = decodeExtraParams(extraParams);
    bytes memory path = encodeAddresses(tokenSwapPath, fees);

    if (isExactInput) {
      if (tokenSwapPath[0] == WETH_ADDRESS) {
        // eth as input
        exactAmount = msg.value;
      } else {
        // erc20 as input
        // get input funds from caller
        inputTokenInstance.safeTransferFrom(
          msg.sender,
          (address(this), exactAmount)
        );

        //approve router to swap tokens
        inputTokenInstance.safeIncreaseAllowance(address(router), exactAmount);
      }

      // swap to collateral token into this wallet
      ISwapRouter.ExactInputParams memory params =
        ISwapRouter.ExactInputParams({
          path: path,
          recipient: address(this),
          deadline: mintParams.expiration,
          amountIn: exactAmount,
          amountOutMinimum: minOutOrMaxIn
        });

      uint256 collateralOut = router.exactInput{value: msg.value}(params);

      // approve synthereum to pull collateral
      collateralInstance.safeIncreaseAllowance(
        address(synthereumPool),
        collateralOut
      );

      // mint jSynth to mintParams.recipient (supposedly msg.sender)
      // returns the output amount
      mintParams.collateralAmount = collateralOut;
      (amountOut, ) = synthereumPool.mint(mintParams);
    } else {
      // exact output (collateral)
      if (tokenSwapPath[0] == WETH_ADDRESS) {
        // max eth as input
        minOutOrMaxIn = msg.value;
      } else {
        // max erc20 as input
        // pull the max input tokens allowed to spend
        inputTokenInstance.safeTransferFrom(
          msg.sender,
          address(this),
          minOutOrMaxIn
        );

        // approve router to swap tokens
        inputTokenInstance.safeIncreaseAllowance(
          address(router),
          minOutOrMaxIn
        );
      }

      // swap to collateral token into this wallet
      ISwapRouter.ExactOutputParams memory params =
        ISwapRouter.ExactOutputParams({
          path: path,
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
          inputTokenInstance.safeTransfer(
            msg.sender,
            minOutOrMaxIn.sub(inputTokenUsed)
          );
        }
      }

      // approve synthereum to pull collateral
      collateralInstance.safeIncreaseAllowance(
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
    bool isExactInput,
    uint256 exactAmount,
    uint256 minOutOrMaxIn,
    address[] memory tokenSwapPath,
    bytes memory extraParams,
    ISynthereumPoolOnChainPriceFeed synthereumPool,
    ISynthereumPoolOnChainPriceFeed.RedeemParams memory redeemParams,
    address payable recipient
  ) external returns (uint256) {
    IERC20 collateralInstance = checkSynthereumPool(synthereumPool);
    require(
      address(collateralInstance) == tokenSwapPath[0],
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
    (uint256 collateralOut, ) = synthereumPool.redeem(redeemParams);

    // unpack the extraParams (fees) and encode the paths
    uint24[] memory fees = decodeExtraParams(extraParams);
    bytes memory path = encodeAddresses(tokenSwapPath, fees);

    // approve router to swap tokens
    collateralInstance.safeIncreaseAllowance(address(router), collateralOut);

    if (isExactInput) {
      // collateral as exact input
      // swap to erc20 token into recipient wallet
      ISwapRouter.ExactInputParams memory params =
        ISwapRouter.ExactInputParams(
          path,
          recipient,
          redeemParams.expiration,
          collateralOut,
          minOutOrMaxIn
        );

      return router.exactInput(params);
    } else {
      // collateralOut as maxInput
      // swap to erc20 token into recipient wallet
      ISwapRouter.ExactOutputParams memory params =
        ISwapRouter.ExactOutputParams(
          path,
          recipient,
          redeemParams.expiration,
          exactAmount,
          collateralOut
        );

      uint256 inputTokensUsed = router.exactOutput(params);

      // refund leftover input (collateral) tokens
      if (collateralOut > inputTokensUsed) {
        collateralInstance.safeTransfer(
          msg.sender,
          collateralOut.sub(inputTokensUsed)
        );
      }

      return inputTokensUsed;
    }
  }

  function decodeExtraParams(bytes memory params)
    internal
    pure
    returns (uint24[] memory)
  {
    return abi.decode(params, (uint24[]));
  }

  // generates the encoded bytes for multihop swap
  function encodeAddresses(address[] memory addresses, uint24[] fees)
    internal
    pure
    returns (bytes memory data)
  {
    /// ie 3 tokens 2 pools
    require(
      address.length == fees.length + 1,
      'Mismatch between tokens and fees'
    );

    for (uint256 i = 0; i < address.length - 1; i++) {
      data = abi.encodePacked(data, addresses[i], fees[i]);
    }

    // last token
    data = abi.encodePacked(data, addresses[i]);
  }
}
