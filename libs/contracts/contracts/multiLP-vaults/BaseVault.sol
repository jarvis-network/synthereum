// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity 0.8.9;

import {
  IMintableBurnableERC20
} from '../tokens/interfaces/IMintableBurnableERC20.sol';
import {IPoolVault} from './interfaces/IPoolVault.sol';
import {ERC2771Context} from '../common/ERC2771Context.sol';
import {ISynthereumFinder} from '../core/interfaces/IFinder.sol';
import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {
  ReentrancyGuard
} from '@openzeppelin/contracts/security/ReentrancyGuard.sol';
import {
  ERC20PermitUpgradeable
} from '@openzeppelin/contracts-upgradeable/token/ERC20/extensions/draft-ERC20PermitUpgradeable.sol';

abstract contract BaseVaultStorage is
  ERC2771Context,
  ReentrancyGuard,
  ERC20PermitUpgradeable
{
  ISynthereumFinder internal synthereumFinder;
  IPoolVault internal pool; // reference pool
  IERC20 internal collateralAsset; // reference pool collateral token

  uint128 internal overCollateralization; // overcollateralization of the vault position
  bool internal isLpActive; // dictates if first deposit on pool or not
}
