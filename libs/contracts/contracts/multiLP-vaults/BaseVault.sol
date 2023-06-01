// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity 0.8.9;

import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {
  IMintableBurnableERC20
} from '../tokens/interfaces/IMintableBurnableERC20.sol';
import {ISynthereumFinder} from '../core/interfaces/IFinder.sol';
import {IPoolVault} from '../synthereum-pool/common/interfaces/IPoolVault.sol';
import {SynthereumInterfaces} from '../core/Constants.sol';
import {
  ContextUpgradeable
} from '@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol';
import {ERC2771Context} from '../common/ERC2771Context.sol';
import {
  ReentrancyGuardUpgradeable
} from '@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol';
import {
  ERC20PermitUpgradeable
} from '@openzeppelin/contracts-upgradeable/token/ERC20/extensions/draft-ERC20PermitUpgradeable.sol';

abstract contract BaseVaultStorage is
  ERC2771Context,
  ReentrancyGuardUpgradeable,
  ERC20PermitUpgradeable
{
  ISynthereumFinder internal synthereumFinder;
  IPoolVault internal pool; // reference pool
  IERC20 internal collateralAsset; // reference pool collateral token
  uint8 internal collateralDecimals; // decimal unit of the collateral

  bool internal isLpActive; // dictates if first deposit on pool or not
  uint8 internal version; // version of the vault
  uint128 internal overCollateralization; // overcollateralization of the vault position
  bytes32 internal priceFeedIdentifier; // price feed id of the pool

  function isTrustedForwarder(address forwarder)
    public
    view
    override
    returns (bool)
  {
    try
      synthereumFinder.getImplementationAddress(
        SynthereumInterfaces.TrustedForwarder
      )
    returns (address trustedForwarder) {
      if (forwarder == trustedForwarder) {
        return true;
      } else {
        return false;
      }
    } catch {
      return false;
    }
  }

  function _msgSender()
    internal
    view
    override(ERC2771Context, ContextUpgradeable)
    returns (address sender)
  {
    return ERC2771Context._msgSender();
  }

  function _msgData()
    internal
    view
    override(ERC2771Context, ContextUpgradeable)
    returns (bytes calldata)
  {
    return ERC2771Context._msgData();
  }
}
