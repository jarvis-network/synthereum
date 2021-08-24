// SPDX-License-Identifier: MIT

pragma solidity >=0.7.5;
pragma abicoder v2;

import '../Base.sol';
import '../interfaces/IKyberRouter.sol';

contract KyberAtomicSwap is BaseAtomicSwap {
  using SafeMath for uint256;
  using SafeERC20 for IERC20;

  IDMMExchangeRouter kyberRouter;

  constructor(
    ISynthereumFinder _synthereum,
    IKyberNetworkProxy _kyberRouter,
    address _wethAddress
  ) BaseAtomicSwap(_wethAddress, _synthereum) {
    kyberRouter = _kyberRouter;
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
    // checks
    require(
      poolsPath.length == tokenSwapPath.length - 1,
      'Pools and tokens length mismatch'
    );
    IERC20 collateralInstance = checkSynthereumPool(synthereumPool);
    require(
      address(collateralInstance) == tokenSwapPath[tokenSwapPath.length - 1],
      'Wrong collateral instance'
    );
    IERC20 inputTokenInstance;

    uint256 collateralOut;

    // swap to collateral token (exact[input/output][ETH/ERC20])
    if (isExactInput) {
      if (tokenSwapPath[0] == WETH_ADDRESS) {
        // swapExactETHForTokens
        collateralOut = kyberRouter.swapExactETHForTokens{value: msg.value}(
          minOutOrMaxIn,
          poolsPath,
          tokenSwapPath,
          address(this),
          mintParams.expiration
        );
      } else {
        // swapExactTokensForTokens
        // get funds from caller
        inputTokenInstance = IERC20(tokenSwapPath[0]);
        inputTokenInstance.safeTransferFrom(
          msg.sender,
          address(this),
          amountSpecified
        );
        //approve kyber router to swap
        inputTokenInstance.safeIncreaseAllowance(
          address(kyberRouter),
          amountSpecified
        );

        // swap to collateral token into this wallet
        uint256[] memory amountsOut =
          kyberRouter.swapExactTokensForTokens(
            amountSpecified,
            minOutOrMaxIn,
            poolsPath,
            tokenSwapPath,
            address(this),
            mintParams.expiration
          );
        // amountsOut.length = tokenSwapPath.length (contains input amount + output amounts inlcuding intermediate)
        collateralOut = amountsOut[tokenSwapPath.length - 1];
      }
    } else {
      uint256 inputAmountUsed;

      if (tokenSwapPath[0] == WETH_ADDRESS) {
        //swapETHForExactTokens
        minOutOrMaxIn = msg.value;

        // swap to exact collateral and refund leftover
        uint256[] memory amountsOut =
          kyberRouter.swapETHForExactTokens{value: msg.value}(
            amountSpecified,
            poolsPath,
            tokenSwapPath,
            address(this),
            mintParams.expiration
          );
        inputAmountUsed = amountsOut[0];
        collateralOut = amountsOut[tokenSwapPath.length - 1];

        if (minOutOrMaxIn > inputAmountUsed) {
          (bool success, ) =
            msg.sender.call{value: minOutOrMaxIn.sub(inputAmountUsed)}('');
          require(success, 'Refund eth failed');
        }
      } else {
        //swapTokensForExactTokens
        // pull the max input tokens allowed to spend
        inputTokenInstance = IERC20(tokenSwapPath[0]);
        inputTokenInstance.safeTransferFrom(
          msg.sender,
          address(this),
          minOutOrMaxIn
        );
        //approve kyber router to swap s
        inputTokenInstance.safeApprove(address(kyberRouter), minOutOrMaxIn);

        // swap to collateral token into this wallet
        uint256[] memory amountsOut =
          kyberRouter.swapTokensForExactTokens(
            amountSpecified,
            minOutOrMaxIn,
            poolsPath,
            tokenSwapPath,
            address(this),
            mintParams.expiration
          );
        inputAmountUsed = amountsOut[0];
        collateralOut = amountsOut[tokenSwapPath.length - 1];

        if (minOutOrMaxIn > inputAmountUsed) {
          // refund leftover input erc20
          inputTokenInstance.safeTransfer(
            msg.sender,
            minOutOrMaxIn.sub(inputAmountUsed)
          );
        }
      }
    }

    // approve synthereum to pull collateral
    collateralInstance.safeIncreaseAllowance(
      address(synthereumPool),
      collateralOut
    );

    // mint jSynth to mintParams.recipient (supposedly msg.sender)
    // returns the output amount
    mintParams.collateralAmount = collateralOut;
    (amountOut, ) = synthereumPool.mint(mintParams);
  }

  // redeem jSynth into collateral and use that to swap into erc20/eth
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
    // checks
    require(
      poolsPath.length == tokenSwapPath.length - 1,
      'Pools and tokens length mismatch'
    );
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

    // approve kyber proxy to swap tokens
    collateralInstance.safeIncreaseAllowance(
      address(kyberRouter),
      collateralOut
    );

    uint256[] memory amountsOut;
    if (isExactInput) {
      // collateralOut as exactInput
      outputTokenInstance == WETH_ADDRESS
        ? amountsOut = kyberRouter.swapExactTokensForETH(
          collateralOut,
          minOutOrMaxIn,
          poolsPath,
          tokenSwapPath,
          recipient,
          redeemParams.expiration
        )
        : amountsOut = kyberRouter.swapExactTokensForTokens(
        collateralOut,
        minOutOrMaxIn,
        poolsPath,
        tokenSwapPath,
        recipient,
        redeemParams.expiration
      );
    } else {
      // collateralOut as maxInput
      outputTokenInstance == WETH_ADDRESS
        ? amountsOut = kyberRouter.swapTokensForExactETH(
          amountSpecified,
          collateralOut,
          poolsPath,
          tokenSwapPath,
          recipient,
          redeemParams.expiration
        )
        : amountsOut = kyberRouter.swapTokensForExactTokens(
        amountSpecified,
        collateralOut,
        poolsPath,
        path,
        recipient,
        redeemParams.expiration
      );

      // eventual collateral refund
      if (collateralOut > amountsOut[0]) {
        collateralInstance.safeTransfer(
          msg.sender,
          collateralOut.sub(amountsOut[0])
        );
      }
    }

    // return output token amount
    return amountsOut[tokenSwapPath.length - 1];
  }
}
