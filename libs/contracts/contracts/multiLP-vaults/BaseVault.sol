// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity 0.8.9;

import {
  IMintableBurnableERC20
} from '../tokens/interfaces/IMintableBurnableERC20.sol';
import {IPoolVault} from './interfaces/IPoolVault.sol';
import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {ISynthereumFinder} from '../core/interfaces/IFinder.sol';

abstract contract BaseVaultStorage {
  IMintableBurnableERC20 internal lpToken; // vault LP token
  IPoolVault internal pool; // reference pool
  IERC20 internal collateralAsset; // reference pool collateral token
  ISynthereumFinder immutable synthereumFinder;

  uint128 internal overCollateralization; // overcollateralization of the vault position
  bool internal isLpActive; // dictates if first deposit on pool or not
}
