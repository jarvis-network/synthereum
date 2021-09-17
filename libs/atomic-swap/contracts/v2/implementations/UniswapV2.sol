pragma solidity ^0.8.4;
pragma abicoder v2;

import '../BaseAtomicSwap.sol';
import {IUniswapV2Router02} from '../interfaces/IUniswapV2Router02.sol';

contract UniV2AtomicSwap is BaseAtomicSwap {
  using SafeERC20 for IERC20;
  using SafeMath for uint256;

  struct ImplementationInfo {
    address routerAddress;
    address synthereumFinder;
    address nativeCryptoAddress;
  }

  constructor() BaseAtomicSwap() {}

  receive() external payable {}

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
    IUniswapV2Router02 router =
      IUniswapV2Router02(implementationInfo.routerAddress);

    // unpack tokenSwapPath from extraParams
    address[] memory tokenSwapPath = decodeExtraParams(extraParams);

    {
      require(
        address(
          checkSynthereumPool(
            implementationInfo.synthereumFinder,
            synthereumPool
          )
        ) == tokenSwapPath[tokenSwapPath.length - 1],
        'Wrong collateral instance'
      );
    }

    uint256 collateralOut;
    if (isExactInput) {
      if (msg.value > 0) {
        //swapExactETHForTokens into this wallet
        collateralOut = router.swapExactETHForTokens{value: msg.value}(
          minOutOrMaxIn,
          tokenSwapPath,
          address(this),
          mintParams.expiration
        )[tokenSwapPath.length - 1];
      } else {
        //swapExactTokensForTokens into this wallet

        IERC20(tokenSwapPath[0]).safeTransferFrom(
          msg.sender,
          address(this),
          exactAmount
        );
        IERC20(tokenSwapPath[0]).safeIncreaseAllowance(
          implementationInfo.routerAddress,
          exactAmount
        );
        collateralOut = router.swapExactTokensForTokens(
          exactAmount,
          minOutOrMaxIn,
          tokenSwapPath,
          address(this),
          mintParams.expiration
        )[tokenSwapPath.length - 1];
      }
    } else {
      if (msg.value > 0) {
        //swapETHForExactTokens
        minOutOrMaxIn = msg.value;
        uint256[] memory amountsOut =
          router.swapETHForExactTokens{value: msg.value}(
            exactAmount,
            tokenSwapPath,
            address(this),
            mintParams.expiration
          );

        collateralOut = amountsOut[tokenSwapPath.length - 1];

        // refund eventual eth leftover
        if (minOutOrMaxIn > amountsOut[0]) {
          (bool success, ) =
            msg.sender.call{value: minOutOrMaxIn.sub(amountsOut[0])}('');
          require(success, 'Refund eth failed');
        }
      } else {
        //swapTokensForExactTokens
        IERC20 inputTokenInstance = IERC20(tokenSwapPath[0]);
        inputTokenInstance.safeTransferFrom(
          msg.sender,
          address(this),
          minOutOrMaxIn
        );
        inputTokenInstance.safeIncreaseAllowance(
          implementationInfo.routerAddress,
          minOutOrMaxIn
        );

        uint256[] memory amountsOut =
          router.swapTokensForExactTokens(
            exactAmount,
            minOutOrMaxIn,
            tokenSwapPath,
            address(this),
            mintParams.expiration
          );

        collateralOut = amountsOut[tokenSwapPath.length - 1];

        if (minOutOrMaxIn > amountsOut[0]) {
          inputTokenInstance.safeTransfer(
            msg.sender,
            minOutOrMaxIn.sub(amountsOut[0])
          );
        }
      }
    }

    // mint jSynth
    IERC20(tokenSwapPath[tokenSwapPath.length - 1]).safeIncreaseAllowance(
      address(synthereumPool),
      collateralOut
    );
    mintParams.collateralAmount = collateralOut;
    (amountOut, ) = synthereumPool.mint(mintParams);
  }

  // redeem jSynth into collateral and use that to swap into erc20/eth
  function redeemCollateralAndSwap(
    bytes calldata info,
    bool isExactInput,
    uint256 exactAmount,
    uint256 minOutOrMaxIn,
    bytes memory extraParams,
    ISynthereumPoolOnChainPriceFeed synthereumPool,
    ISynthereumPoolOnChainPriceFeed.RedeemParams memory redeemParams,
    address payable recipient
  ) external returns (uint256) {
    // decode implementation info
    ImplementationInfo memory implementationInfo =
      decodeImplementationInfo(info);

    // instantiate router
    IUniswapV2Router02 router =
      IUniswapV2Router02(implementationInfo.routerAddress);

    // unpack tokenSwapPath from extraParams
    address[] memory tokenSwapPath = decodeExtraParams(extraParams);

    // check pool
    require(
      address(
        checkSynthereumPool(implementationInfo.synthereumFinder, synthereumPool)
      ) == tokenSwapPath[0],
      'Wrong collateral instance'
    );
    address outputTokenAddress = tokenSwapPath[tokenSwapPath.length - 1];
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

    IERC20(tokenSwapPath[0]).safeIncreaseAllowance(
      implementationInfo.routerAddress,
      collateralOut
    );
    uint256[] memory amountsOut;

    if (isExactInput) {
      // collateralOut as exactInput
      outputTokenAddress == implementationInfo.nativeCryptoAddress
        ? amountsOut = router.swapExactTokensForETH(
          collateralOut,
          minOutOrMaxIn,
          tokenSwapPath,
          recipient,
          redeemParams.expiration
        )
        : amountsOut = router.swapExactTokensForTokens(
        collateralOut,
        minOutOrMaxIn,
        tokenSwapPath,
        recipient,
        redeemParams.expiration
      );
    } else {
      // collateralOut as maxInput
      outputTokenAddress == implementationInfo.nativeCryptoAddress
        ? amountsOut = router.swapTokensForExactETH(
          exactAmount,
          collateralOut,
          tokenSwapPath,
          recipient,
          redeemParams.expiration
        )
        : amountsOut = router.swapTokensForExactTokens(
        exactAmount,
        collateralOut,
        tokenSwapPath,
        recipient,
        redeemParams.expiration
      );

      // eventual collateral refund
      if (collateralOut > amountsOut[0]) {
        IERC20(tokenSwapPath[0]).safeTransfer(
          msg.sender,
          collateralOut.sub(amountsOut[0])
        );
      }
    }

    // return output token amount
    return amountsOut[tokenSwapPath.length - 1];
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
