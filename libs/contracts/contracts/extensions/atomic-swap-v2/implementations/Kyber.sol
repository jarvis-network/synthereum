// SPDX-License-Identifier: MIT

pragma solidity >=0.7.5;
pragma abicoder v2;

import '../BaseAtomicSwap.sol';
import '../interfaces/IKyberRouter.sol';

contract KyberAtomicSwap is BaseAtomicSwap {
  constructor() BaseAtomicSwap() {}

  receive() external payable {}

  /// @param extraParams is in this case pools addresses to swap through (abi-encoded)
  function swapToCollateralAndMint(
    ImplementationInfo memory info,
    bool isExactInput,
    uint256 exactAmount,
    uint256 minOutOrMaxIn,
    address[] memory tokenSwapPath,
    bytes memory extraParams,
    ISynthereumPoolOnChainPriceFeed synthereumPool,
    ISynthereumPoolOnChainPriceFeed.MintParams memory mintParams
  ) external payable returns (uint256 amountOut) {
    // insantiate router
    IDMMExchangeRouter memory kyberRouter =
      IDMMExchangeRouter(info.routerAddress);

    // unpack the extraParams
    address[] memory poolsPath = decodeExtraParams(extraParams);

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
      if (msg.value > 0) {
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
          exactAmount
        );
        //approve kyber router to swap
        inputTokenInstance.safeIncreaseAllowance(
          info.routerAddress,
          exactAmount
        );

        // swap to collateral token into this wallet
        uint256[] memory amountsOut =
          kyberRouter.swapExactTokensForTokens(
            exactAmount,
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

      if (msg.value > 0) {
        //swapETHForExactTokens
        minOutOrMaxIn = msg.value;

        // swap to exact collateral and refund leftover
        uint256[] memory amountsOut =
          kyberRouter.swapETHForExactTokens{value: msg.value}(
            exactAmount,
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
        inputTokenInstance.safeIncreaseAllowance(
          info.routerAddress,
          minOutOrMaxIn
        );

        // swap to collateral token into this wallet
        uint256[] memory amountsOut =
          kyberRouter.swapTokensForExactTokens(
            exactAmount,
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
  /// @param extraParams is in this case pools addresses to swap through (abi-encoded)
  function redeemCollateralAndSwap(
    ImplementationInfo memory info,
    bool isExactInput,
    uint256 exactAmount,
    uint256 minOutOrMaxIn,
    address[] memory tokenSwapPath,
    bytes memory extraParams,
    ISynthereumPoolOnChainPriceFeed synthereumPool,
    ISynthereumPoolOnChainPriceFeed.RedeemParams memory redeemParams,
    address payable recipient
  ) external returns (uint256) {
    // insantiate router
    IDMMExchangeRouter memory kyberRouter =
      IDMMExchangeRouter(info.routerAddress);

    // unpack the extraParams
    address[] memory poolsPath = decodeExtraParams(extraParams);
    // checks
    require(
      poolsPath.length == tokenSwapPath.length - 1,
      'Pools and tokens length mismatch'
    );
    IERC20 collateralInstance =
      checkSynthereumPool(info.synthereumFinder, synthereumPool);
    require(
      address(collateralInstance) == tokenSwapPath[0],
      'Wrong collateral instance'
    );
    address outputTokenInstance = tokenSwapPath[tokenSwapPath.length - 1];
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
    collateralInstance.safeIncreaseAllowance(info.routerAddress, collateralOut);

    uint256[] memory amountsOut;
    if (isExactInput) {
      // collateralOut as exactInput
      outputTokenInstance == info.nativeCryptoAddress
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
      outputTokenInstance == info.nativeCryptoAddress
        ? amountsOut = kyberRouter.swapTokensForExactETH(
          exactAmount,
          collateralOut,
          poolsPath,
          tokenSwapPath,
          recipient,
          redeemParams.expiration
        )
        : amountsOut = kyberRouter.swapTokensForExactTokens(
        exactAmount,
        collateralOut,
        poolsPath,
        tokenSwapPath,
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

  // generic function that each AtomicSwap implementation can implement
  // in order to receive extra params
  // extra params are in here the poolsPaths
  function decodeExtraParams(bytes memory params)
    internal
    pure
    returns (address[] memory)
  {
    return abi.decode(params, (address[]));
  }
}
