// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity 0.8.9;

import {
  IMintableBurnableERC20
} from '../tokens/interfaces/IMintableBurnableERC20.sol';
import {
  ISynthereumMLPPool
} from '../synthereum-pool/v7/interfaces/IMLPPool.sol';
import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';

abstract contract BaseVaultStorage {
  IMintableBurnableERC20 internal lpToken; // vault LP token
  ISynthereumMLPPool internal pool; // reference pool
  IERC20 internal collateralAsset; // reference pool collateral token

  uint128 internal overCollateralization; // overcollateralization of the vault position
  bool internal isLpActive; // dictates if first deposit on pool or not
}
