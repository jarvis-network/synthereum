// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import '@openzeppelin/contracts/math/SafeMath.sol';
import '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';
import '../../synthereum-pool/v4/interfaces/IPoolOnChainPriceFeed.sol';
import './interfaces/IUniswapV2Factory.sol';
import './interfaces/IUniswapV2Router01.sol';
import './interfaces/IUniswapV2Router02.sol';

contract AtomicSwap {
  using SafeMath for uint256;
  using SafeERC20 for IERC20;

  // Variables

  IUniswapV2Router02 uniswapRouter;

  constructor(address uniswapRouterAddress) public {
    uniswapRouter = IUniswapV2Router02(uniswapRouterAddress);
  }

  // Functions

  // 1. User approves transfer of token to AtomicSwap contract (triggered by the frontend)
  // 2. User calls AtomicSwap.swapAndMint() (triggered by the frontend)
  //    2.1 AtomicSwap transfers token from user to itself (internal tx)
  //    2.2 AtomicSwap approves IUniswapV2Router02 (internal tx)
  //    2.3 AtomicSwap calls IUniswapV2Router02.swapExactTokensForTokens() to exchange token for collateral (internal tx)
  //    2.4 AtomicSwap approves SynthereumPool (internal tx)
  //    2.5 AtomicSwap calls SynthereumPool.mint() to mint synth with collateral (internal tx)
  //    2.6 AtomicSwap transfers the minted synth to user (internal tx)
  function swapAndMint(
    uint256 tokenAmountIn,
    uint256 collateralAmountOutMin,
    address[] calldata tokenSwapPath,
    ISynthereumPoolOnChainPriceFeed synthereumPool,
    ISynthereumPoolOnChainPriceFeed.MintParams memory mintParams
  ) public returns (uint256 collateralOut, uint256 syntheticTokensMinted) {
    IERC20 collateralInstance = synthereumPool.collateralToken();
    require(
      address(collateralInstance) == tokenSwapPath[tokenSwapPath.length - 1],
      'Wrong collateral instance'
    );

    IERC20 synth = synthereumPool.syntheticToken();
    IERC20 tokenInstance = IERC20(tokenSwapPath[0]);

    tokenInstance.safeTransferFrom(msg.sender, address(this), tokenAmountIn);

    tokenInstance.safeApprove(address(uniswapRouter), tokenAmountIn);

    collateralOut = uniswapRouter.swapExactTokensForTokens(
      tokenAmountIn,
      collateralAmountOutMin,
      tokenSwapPath,
      address(this),
      mintParams.expiration
    )[1];

    collateralInstance.safeApprove(address(synthereumPool), collateralOut);

    mintParams.collateralAmount = collateralOut;
    (syntheticTokensMinted, ) = synthereumPool.mint(mintParams);
  }

  // Transaction overview:
  // 1. User approves transfer of synth to `AtomicSwap` contract (triggered by the frontend)
  // 2. User calls `AtomicSwap.redeemAndSwap()` (triggered by the frontend)
  //   2.1 `AtomicSwaps` transfers synth from user to itself (internal tx)
  //   2.2 `AtomicSwaps` approves transfer of synth from itself to pool (internal tx)
  //   2.3 `AtomicSwap` calls `pool.redeem()` to redeem synth for collateral (internal tx)
  //   2.4 `AtomicSwap` approves transfer of collateral to `IUniswapV2Router02` (internal tx)
  //   2.5 `AtomicSwap` calls `IUniswapV2Router02.swapExactTokensForTokens` to swap collateral for token (internal tx)
  //   2.6 `AtomicSwap` transfers token from itself to user (internal tx)
  function redeemAndSwap(
    uint256 amountTokenOutMin,
    address[] calldata tokenSwapPath,
    ISynthereumPoolOnChainPriceFeed synthereumPool,
    ISynthereumPoolOnChainPriceFeed.RedeemParams memory redeemParams,
    address recipient
  ) public returns (uint256 tokenOut, uint256 collateralRedeemed) {
    IERC20 collateralInstance = synthereumPool.collateralToken();
    require(
      address(collateralInstance) == tokenSwapPath[0],
      'Wrong collateral instance'
    );

    IERC20 synth = synthereumPool.syntheticToken();

    synth.safeTransferFrom(msg.sender, address(this), redeemParams.numTokens);
    synth.safeApprove(address(synthereumPool), redeemParams.numTokens);

    redeemParams.recipient = address(this);
    (collateralRedeemed, ) = synthereumPool.redeem(redeemParams);

    collateralInstance.safeApprove(address(uniswapRouter), collateralRedeemed);

    tokenOut = uniswapRouter.swapExactTokensForTokens(
      collateralRedeemed,
      amountTokenOutMin,
      tokenSwapPath,
      recipient,
      redeemParams.expiration
    )[1];
  }

  /* function swapETHAndMint(
    uint256 tokenAmountIn,
    uint256 collateralAmountOutMin,
    address[] calldata tokenSwapPath,
    ISynthereumPoolOnChainPriceFeed synthereumPool,
    ISynthereumPoolOnChainPriceFeed.MintParams memory mintParams
  )
    public
    payable
    returns (uint256 collateralOut, uint256 syntheticTokensMinted)
  {
    IERC20 collateralInstance = synthereumPool.collateralToken();
    IERC20 synth = synthereumPool.syntheticToken();
    IERC20 tokenInstance = IERC20(tokenSwapPath[0]);

    tokenInstance.safeTransferFrom(msg.sender, address(this), tokenAmountIn);

    tokenInstance.safeApprove(address(uniswapRouter), tokenAmountIn);

    address[] memory tmpSwapPath = new address[](tokenSwapPath.length + 1);
    for (uint256 i = 0; i < tokenSwapPath.length; i++) {
      tmpSwapPath[i] = tokenSwapPath[i];
    }
    tmpSwapPath[tmpSwapPath.length - 1] = address(collateralInstance);

    collateralOut = uniswapRouter.swapExactETHForTokens(
      tokenAmountIn,
      collateralAmountOutMin,
      tmpSwapPath,
      address(this),
      mintParams.expiration
    )[1];

    collateralInstance.safeApprove(address(synthereumPool), collateralOut);

    mintParams.collateralAmount = collateralOut;
    (syntheticTokensMinted, ) = synthereumPool.mint(mintParams);

    synth.safeTransfer(msg.sender, syntheticTokensMinted);
  }

  function redeemAndSwapETH(
    uint256 amountTokenOutMin,
    address[] calldata tokenSwapPath,
    ISynthereumPoolOnChainPriceFeed synthereumPool,
    ISynthereumPoolOnChainPriceFeed.RedeemParams memory redeemParams
  ) public returns (uint256 tokenOut, uint256 collateralRedeemed) {
    IERC20 synth = synthereumPool.syntheticToken();
    IERC20 collateral = synthereumPool.collateralToken();

    synth.safeTransferFrom(msg.sender, address(this), redeemParams.numTokens);
    synth.safeApprove(address(synthereumPool), redeemParams.numTokens);

    (collateralRedeemed, ) = synthereumPool.redeem(redeemParams);

    collateral.safeApprove(address(uniswapRouter), collateralRedeemed);

    address[] memory tmpSwapPath = new address[](tokenSwapPath.length + 1);
    tmpSwapPath[0] = address(collateral);
    for (uint256 i = 0; i < tokenSwapPath.length; i++) {
      tmpSwapPath[i + 1] = tokenSwapPath[i];
    }

    tokenOut = uniswapRouter.swapExactTokensForETH(
      collateralRedeemed,
      amountTokenOutMin,
      tmpSwapPath,
      msg.sender,
      redeemParams.expiration
    )[1];
  }*/
}
