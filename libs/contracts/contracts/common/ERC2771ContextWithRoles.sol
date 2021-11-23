// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {ERC2771Context} from './ERC2771Context.sol';
import {
  AccessControlEnumerable
} from '@openzeppelin/contracts/access/AccessControlEnumerable.sol';
import {Context} from '@openzeppelin/contracts/utils/Context.sol';

/**
 * @dev Context variant with ERC2771 support with roles
 */
abstract contract ERC2771ContextWithRoles is
  ERC2771Context,
  AccessControlEnumerable
{
  function _msgSender()
    internal
    view
    virtual
    override(ERC2771Context, Context)
    returns (address sender)
  {
    return ERC2771Context._msgSender();
  }

  function _msgData()
    internal
    view
    virtual
    override(ERC2771Context, Context)
    returns (bytes calldata)
  {
    return ERC2771Context._msgData();
  }
}
