// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.6.12;

import {
  IERC20
} from '../../../../@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {ISynthereumFinder} from '../../../core/interfaces/IFinder.sol';
import {IRole} from '../../../base/interfaces/IRole.sol';
import {
  IDerivative
} from '../../../derivative/common/interfaces/IDerivative.sol';

interface ISynthereumPoolDeployment {
  function synthereumFinder() external view returns (ISynthereumFinder finder);

  function version() external view returns (uint8 poolVersion);

  function collateralToken() external view returns (IERC20 collateralCurrency);

  function syntheticToken() external view returns (IERC20 syntheticCurrency);

  function syntheticTokenSymbol() external view returns (string memory symbol);

  function isDerivativeAdmitted(address derivative)
    external
    view
    returns (bool isAdmitted);
}
