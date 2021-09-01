// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;
pragma abicoder v2;

import '../BaseAtomicSwap.sol';
import '../interfaces/IKyberRouter.sol';

contract KyberAtomicSwap is BaseAtomicSwap {
  using SafeMath for uint256;
  using SafeERC20 for IERC20;

  constructor() BaseAtomicSwap() {}

  receive() external payable {}

  /// @param extraParams is in this case pools addresses to swap through (abi-encoded)
  function swapToCollateralAndMint(
    ImplementationInfo memory info,
    bool isExactInput,
    uint256 exactAmount,
    uint256 minOutOrMaxIn,
    bytes memory extraParams,
    ISynthereumPoolOnChainPriceFeed synthereumPool,
    ISynthereumPoolOnChainPriceFeed.MintParams memory mintParams
  ) external payable returns (uint256 amountOut) {
    // insantiate router
    IDMMExchangeRouter kyberRouter = IDMMExchangeRouter(info.routerAddress);

    // unpack the extraParams
    (address[] memory poolsPath, IERC20[] memory tokenSwapPath) =
      decodeExtraParams(extraParams);

    // checks
    require(
      poolsPath.length == tokenSwapPath.length - 1,
      'Pools and tokens length mismatch'
    );
    IERC20 collateralInstance =
      checkSynthereumPool(info.synthereumFinder, synthereumPool);
    require(
      collateralInstance == tokenSwapPath[tokenSwapPath.length - 1],
      'Wrong collateral instance'
    );

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
        )[tokenSwapPath.length - 1];
      } else {
        // swapExactTokensForTokens
        // get funds from caller
        tokenSwapPath[0].safeTransferFrom(
          msg.sender,
          address(this),
          exactAmount
        );
        //approve kyber router to swap
        tokenSwapPath[0].safeIncreaseAllowance(info.routerAddress, exactAmount);

        // swap to collateral token into this wallet
        collateralOut = kyberRouter.swapExactTokensForTokens(
          exactAmount,
          minOutOrMaxIn,
          poolsPath,
          tokenSwapPath,
          address(this),
          mintParams.expiration
        )[tokenSwapPath.length - 1];
      }
    } else {
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

        collateralOut = amountsOut[tokenSwapPath.length - 1];

        if (minOutOrMaxIn > amountsOut[0]) {
          (bool success, ) =
            msg.sender.call{value: minOutOrMaxIn.sub(amountsOut[0])}('');
          require(success, 'Refund eth failed');
        }
      } else {
        //swapTokensForExactTokens
        // pull the max input tokens allowed to spend
        tokenSwapPath[0].safeTransferFrom(
          msg.sender,
          address(this),
          minOutOrMaxIn
        );
        //approve kyber router to swap s
        tokenSwapPath[0].safeIncreaseAllowance(
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
        collateralOut = amountsOut[tokenSwapPath.length - 1];

        if (minOutOrMaxIn > amountsOut[0]) {
          // refund leftover input erc20
          tokenSwapPath[0].safeTransfer(
            msg.sender,
            minOutOrMaxIn.sub(amountsOut[0])
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
    bytes memory extraParams,
    ISynthereumPoolOnChainPriceFeed synthereumPool,
    ISynthereumPoolOnChainPriceFeed.RedeemParams memory redeemParams,
    address payable recipient
  ) external returns (uint256) {
    // insantiate router
    IDMMExchangeRouter kyberRouter = IDMMExchangeRouter(info.routerAddress);

    // unpack the extraParams
    (address[] memory poolsPath, IERC20[] memory tokenSwapPath) =
      decodeExtraParams(extraParams);

    // checks
    require(
      poolsPath.length == tokenSwapPath.length - 1,
      'Pools and tokens length mismatch'
    );
    require(
      checkSynthereumPool(info.synthereumFinder, synthereumPool) ==
        tokenSwapPath[0],
      'Wrong collateral instance'
    );
    address outputTokenInstance =
      address(tokenSwapPath[tokenSwapPath.length - 1]);
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

    redeemParams.recipient = address(this);
    (uint256 collateralOut, ) = synthereumPool.redeem(redeemParams);

    // approve kyber proxy to swap tokens
    tokenSwapPath[0].safeIncreaseAllowance(info.routerAddress, collateralOut);

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
        tokenSwapPath[0].safeTransfer(
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
    returns (address[] memory, IERC20[] memory)
  {
    return abi.decode(params, (address[], IERC20[]));
  }
}
