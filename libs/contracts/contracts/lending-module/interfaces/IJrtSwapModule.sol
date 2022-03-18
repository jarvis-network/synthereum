// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity >=0.8.0;

interface IJRTSwapModule {
  function swapToJRT(
    address recipient,
    uint256 amountIn,
    bytes memory params
  ) external returns (uint256 amountOut);
}
