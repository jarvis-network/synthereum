// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity >=0.8.0;

interface IJRTSwapModule {
  /**
   * @notice executes an AMM swap from collateral to JRT
   * @param recipient address receiving JRT tokens
   * @param collateral address of the collateral token to swap
   * @param amountIn exact amount of collateral to swap
   * @param params extra params needed on the specific implementation (with different AMM)
   * @return amountOut amount of JRT in output
   */
  function swapToJRT(
    address recipient,
    address collateral,
    uint256 amountIn,
    bytes memory params
  ) external returns (uint256 amountOut);
}
