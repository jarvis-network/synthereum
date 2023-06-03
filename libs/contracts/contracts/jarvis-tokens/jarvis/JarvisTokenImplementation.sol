// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity 0.8.9;

import {ISynthereumFinder} from '../../core/interfaces/IFinder.sol';
import {SynthereumInterfaces} from '../../core/Constants.sol';
import {
  ContextUpgradeable
} from '@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol';
import {ERC2771Context} from '../../common/ERC2771Context.sol';
import {
  ERC20PermitUpgradeable
} from '@openzeppelin/contracts-upgradeable/token/ERC20/extensions/draft-ERC20PermitUpgradeable.sol';

contract JarvisTokenImplementation is ERC2771Context, ERC20PermitUpgradeable {
  ISynthereumFinder public immutable synthereumFinder;
  uint8 public immutable version;

  constructor(ISynthereumFinder _finder) {
    synthereumFinder = _finder;
    version = 1;
    _disableInitializers();
  }

  function initialize(uint256 _totSupply, address _recipient)
    external
    initializer
  {
    __ERC20_init('JARVIS', 'JARVIS');
    __ERC20Permit_init('JARVIS');
    require(_totSupply > 0, 'No initial supply');
    require(_recipient != address(0), 'Null initial recipient');
    _mint(_recipient, _totSupply);
  }

  function transferToMany(
    address[] calldata _recipients,
    uint256[] calldata _values
  ) external returns (bool) {
    require(_recipients.length == _values.length);
    for (uint256 i = 0; i < _values.length; i++) {
      require(transfer(_recipients[i], _values[i]));
    }
    return true;
  }

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
