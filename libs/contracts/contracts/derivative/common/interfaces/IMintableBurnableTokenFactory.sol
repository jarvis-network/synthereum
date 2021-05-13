// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.6.12;
import {MintableBurnableIERC20} from './MintableBurnableIERC20.sol';

interface IMintableBurnableTokenFactory {
  function createToken(
    string memory tokenName,
    string memory tokenSymbol,
    uint8 tokenDecimals
  ) external returns (MintableBurnableIERC20 newToken);
}
