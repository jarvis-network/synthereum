// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {Client} from '@chainlink/contracts-ccip/src/v0.8/ccip/libraries/Client.sol';
import {IAny2EVMMessageReceiver} from '@chainlink/contracts-ccip/src/v0.8/ccip/interfaces/IAny2EVMMessageReceiver.sol';

contract MockCCIPRouter {
  constructor() {}

  function isChainSupported(uint64 chainSelector)
    external
    view
    returns (bool supported)
  {
    supported = true;
  }

  function getSupportedTokens(uint64 chainSelector)
    external
    view
    returns (address[] memory tokens)
  {}

  function getFee(
    uint64 destinationChainSelector,
    Client.EVM2AnyMessage memory message
  ) external view returns (uint256 fee) {
    fee = 0;
  }

  function ccipSend(
    address ccipReceiver,
    uint64 destinationChainSelector,
    Client.Any2EVMMessage memory message
  ) external payable returns (bytes32) {
    IAny2EVMMessageReceiver(ccipReceiver).ccipReceive(message);
  }
}
