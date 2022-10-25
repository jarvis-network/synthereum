// SPDX-License-Identifier: AGPL-3.0-only

pragma solidity ^0.8.9;

interface ICompoundToken {
  function mintBehalf(address, uint256) external returns (uint256);

  function exchangeRateCurrent() external returns (uint256);

  function supplyRatePerBlock() external returns (uint256);

  function redeem(uint256) external returns (uint256);

  function redeemUnderlying(uint256) external returns (uint256);

  function balanceOfUnderlying(address owner) external returns (uint256);

  function balanceOf(address owner) external view returns (uint256);

  function name() external view returns (string memory);

  function getAccountSnapshot(address account)
    external
    view
    returns (
      uint256,
      uint256,
      uint256,
      uint256
    );
}
