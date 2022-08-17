// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// mimics API3 server interface
interface IDapiServer {
  function readDataFeedWithDapiName(bytes32 dapiName)
    external
    view
    returns (int224 value, uint32 timestamp);

  function readDataFeedValueWithDapiName(bytes32 dapiName)
    external
    view
    returns (int224 value);
}
