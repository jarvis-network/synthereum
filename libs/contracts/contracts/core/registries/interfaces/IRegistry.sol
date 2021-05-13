// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';

interface ISynthereumRegistry {
  function register(
    string calldata syntheticTokenSymbol,
    IERC20 collateralToken,
    uint8 poolVersion,
    address pool
  ) external;

  function isDeployed(
    string calldata poolSymbol,
    IERC20 collateral,
    uint8 poolVersion,
    address pool
  ) external view returns (bool isElementDeployed);

  function getElements(
    string calldata poolSymbol,
    IERC20 collateral,
    uint8 poolVersion
  ) external view returns (address[] memory);

  function getSyntheticTokens() external view returns (string[] memory);

  function getVersions() external view returns (uint8[] memory);

  function getCollaterals() external view returns (address[] memory);
}
