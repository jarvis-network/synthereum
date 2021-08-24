// SPDX-License-Identifier: MIT

pragma solidity >=0.7.5;
pragma abicoder v2;

import '../Base.sol';
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

  function swapToCollateralAndMint(
    bool isExactInput,
    uint256 amountSpecified,
    uint256 minOutOrMaxIn,
    address[] memory tokenSwapPath,
    address[] memory poolsPath,
    ISynthereumPoolOnChainPriceFeed synthereumPool,
    ISynthereumPoolOnChainPriceFeed.MintParams memory mintParams
  ) external payable returns (uint256 amountOut) {
    // TODO in interface
    uint24 fee = 3000;
    IERC20 collateralInstance = checkSynthereumPool(synthereumPool);
    require(
      address(collateralInstance) == tokenSwapPath[tokenSwapPath.length - 1],
      'Wrong collateral instance'
    );
    IERC20 inputTokenInstance = IERC20(tokenSwapPath[0]);

    // encode the paths
    bytes memory path = encodeAddresses(tokenSwapPath, fee);

    if (isExactInput) {
      if (tokenSwapPath[0] == WETH_ADDRESS) {
        // eth as input
        amountSpecified = msg.value;
      } else {
        // erc20 as input
        // get input funds from caller
        inputTokenInstance.safeTransferFrom(
          msg.sender,
          (address(this), amountSpecified)
        );

        //approve router to swap tokens
        inputTokenInstance.safeIncreaseAllowance(
          address(router),
          amountSpecified
        );
      }

      // swap to collateral token into this wallet
      ISwapRouter.ExactInputParams memory params =
        ISwapRouter.ExactInputParams({
          path: path,
          recipient: address(this),
          deadline: mintParams.expiration,
          amountIn: amountSpecified,
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
        inputTokenInstance.safeApprove(address(router), minOutOrMaxIn);
      }

      // swap to collateral token into this wallet
      ISwapRouter.ExactOutputParams memory params =
        ISwapRouter.ExactOutputParams({
          path: path,
          recipient: address(this),
          deadline: mintParams.expiration,
          amountOut: amountSpecified,
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
        amountSpecified
      );

      // mint jSynth to mintParams.recipient (supposedly msg.sender)
      // returns the output amount
      mintParams.collateralAmount = amountSpecified;
      (amountOut, ) = synthereumPool.mint(mintParams);
    }
  }

  function redeemCollateralAndSwap(
    bool isExactInput,
    uint256 amountSpecified,
    uint256 minOutOrMaxIn,
    address[] memory tokenSwapPath,
    address[] memory poolsPath,
    ISynthereumPoolOnChainPriceFeed synthereumPool,
    ISynthereumPoolOnChainPriceFeed.RedeemParams memory redeemParams,
    address payable recipient
  ) external returns (uint256) {
    // TODO iinn interface
    uint24 fee = 3000;

    IERC20 collateralInstance = checkSynthereumPool(synthereumPool);
    require(
      address(collateralInstance) == tokenSwapPath[0],
      'Wrong collateral instance'
    );
    IERC20 outputTokenInstance =
      IERC20(tokenSwapPath[tokenSwapPath.length - 1]);
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

    // encode the paths
    bytes memory path = encodeAddresses(tokenSwapPath, fee);

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
          amountSpecified,
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

  // generates the encoded bytes for multihop swap
  // TODO uses only one fee tiers
  function encodeAddresses(address[] memory addresses, uint256 fee)
    internal
    pure
    returns (bytes memory data)
  {
    for (uint256 i = 0; i < address.length - 1; i++) {
      data = abi.encodePacked(data, addresses[i], fee);
    }

    // last token
    data = abi.encodePacked(data, addresses[i]);
  }
}
