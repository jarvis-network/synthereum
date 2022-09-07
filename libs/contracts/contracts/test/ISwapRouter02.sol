// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity 0.8.9;

interface ISwapRouter02 {
  struct ExactOutputSingleParams {
    address tokenIn;
    address tokenOut;
    uint24 fee;
    address recipient;
    uint256 amountOut;
    uint256 amountInMaximum;
    uint160 sqrtPriceLimitX96;
  }

  function exactOutputSingle(ExactOutputSingleParams calldata params)
    external
    payable
    returns (uint256 amountIn);

  function wrapETH(uint256 value) external payable;
}
