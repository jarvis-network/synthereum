// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// mimics API3 server interface
interface IDapiServer {
  function readDataFeedValueWithId(bytes32 priceFeedId)
    external
    view
    returns (int224 value);
}
