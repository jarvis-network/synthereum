// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

// A limited mock contract to simulate DapiServer. See the original for more info
// https://github.com/api3dao/airnode-protocol-v1/blob/main/contracts/dapis/DapiServer.sol
contract MockDapiServer {
  struct DataFeed {
    int224 value;
    uint32 timestamp;
  }

  // A flag that will cause all read calls to revert when reset
  bool public allowedToRead = true;

  mapping(bytes32 => DataFeed) private dataFeeds;

  mapping(bytes32 => bytes32) private dapiNameHashToDataFeedId;

  // Mocks the value and timestamp of a data feed
  function mockDataFeed(
    bytes32 dataFeedId,
    int224 value,
    uint32 timestamp
  ) external {
    require(timestamp != 0, 'Timestamp zero');
    dataFeeds[dataFeedId] = DataFeed({value: value, timestamp: timestamp});
  }

  // Mocks the mapping of a dAPI name to a data feed
  function mockDapiName(bytes32 dapiName, bytes32 dataFeedId) external {
    require(dapiName != bytes32(0), 'dAPI name zero');
    dapiNameHashToDataFeedId[
      keccak256(abi.encodePacked(dapiName))
    ] = dataFeedId;
  }

  // Mocks reads being allowed or not
  function mockIfAllowedToRead(bool _allowedToRead) external {
    allowedToRead = _allowedToRead;
  }

  // Reads a data feed using the data feed ID
  function readDataFeedWithId(bytes32 dataFeedId)
    external
    view
    returns (int224 value, uint32 timestamp)
  {
    require(allowedToRead, 'Sender cannot read');
    DataFeed storage dataFeed = dataFeeds[dataFeedId];
    return (dataFeed.value, dataFeed.timestamp);
  }

  // Reads a data feed using the data feed ID. Omits the timestamp.
  function readDataFeedValueWithId(bytes32 dataFeedId)
    external
    view
    returns (int224 value)
  {
    require(allowedToRead, 'Sender cannot read');
    DataFeed storage dataFeed = dataFeeds[dataFeedId];
    require(dataFeed.timestamp != 0, 'Data feed does not exist');
    return dataFeed.value;
  }

  // Reads a data feed using the dAPI name that is mapped to a data feed
  function readDataFeedWithDapiName(bytes32 dapiName)
    external
    view
    returns (int224 value, uint32 timestamp)
  {
    bytes32 dapiNameHash = keccak256(abi.encodePacked(dapiName));
    require(allowedToRead, 'Sender cannot read');
    bytes32 dataFeedId = dapiNameHashToDataFeedId[dapiNameHash];
    require(dataFeedId != bytes32(0), 'dAPI name not set');
    DataFeed storage dataFeed = dataFeeds[dataFeedId];
    return (dataFeed.value, dataFeed.timestamp);
  }

  // Reads a data feed using the dAPI name that is mapped to a data feed.
  // Omits the timestamp.
  function readDataFeedValueWithDapiName(bytes32 dapiName)
    external
    view
    returns (int224 value)
  {
    bytes32 dapiNameHash = keccak256(abi.encodePacked(dapiName));
    require(allowedToRead, 'Sender cannot read');
    DataFeed storage dataFeed = dataFeeds[
      dapiNameHashToDataFeedId[dapiNameHash]
    ];
    require(dataFeed.timestamp != 0, 'Data feed does not exist');
    return dataFeed.value;
  }
}
