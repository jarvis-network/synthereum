// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.6.12;

import {IERC20} from '../../../@openzeppelin/contracts/token/ERC20/IERC20.sol';

interface ISelfMintingRegistry {
  function registerSelfMintingDerivative(
    string calldata syntheticTokenSymbol,
    IERC20 collateralToken,
    uint8 selfMintingVersion,
    address selfMintingDerivative
  ) external;

  function isSelfMintingDerivativeDeployed(
    string calldata selfMintingDerivativeSymbol,
    IERC20 collateral,
    uint8 selfMintingVersion,
    address selfMintingDerivative
  ) external view returns (bool isDeployed);

  function getSelfMintingDerivatives(
    string calldata selfMintingDerivativeSymbol,
    IERC20 collateral,
    uint8 selfMintingVersion
  ) external view returns (address[] memory);

  function getCollaterals() external view returns (address[] memory);
}
