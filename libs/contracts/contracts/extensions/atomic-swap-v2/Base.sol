// SPDX-License-Identifier: MIT

pragma solidity >=0.7.5;

import './IAtomicSwapV2.sol';

contract BaseAtomicSwap {
  IAtomicSwapV2 public atomicSwapIface;

  // id is sha3(stringID) ie sha3('sushi'), sha3('uniV2') and so on
  // that means only one implementation for each specific dex can exist
  // on UI side, by fixing the identifiers string no fix needs to be done in case on implementations address change
  mapping(bytes32 => address) idToAddress;

  address admin;
}
