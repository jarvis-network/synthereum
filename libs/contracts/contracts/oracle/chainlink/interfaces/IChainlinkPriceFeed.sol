// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.4;

import {
  AggregatorV3Interface
} from '@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol';
import {ISynthereumPriceFeed} from '../../common/interfaces/IPriceFeed.sol';

interface ISynthereumChainlinkPriceFeed is ISynthereumPriceFeed {
  struct OracleData {
    uint80 roundId;
    uint256 answer;
    uint256 startedAt;
    uint256 updatedAt;
    uint80 answeredInRound;
    uint8 decimals;
  }
  enum Type {STANDARD, INVERSE, COMPUTED}

  /**
   * @notice Set a pair object associated to a price identifier
   * @param priceIdentifier Price feed identifier of the pair
   * @param aggregator Address of chainlink proxy aggregator
   * @param intermediatePairs Price feed identifier of the pairs to use for computed price
   * @param kind Dictates what kind of price identifier is being registered
   */
  function setPair(
    Type kind,
    bytes32 priceIdentifier,
    address aggregator,
    bytes32[] memory intermediatePairs
  ) external;

  /**
   * @notice Delete the Pair object associated to a price identifier
   * @param priceIdentifier Price feed identifier
   */
  function removePair(bytes32 priceIdentifier) external;

  /**
   * @notice Returns the address of aggregator if exists, otherwise it reverts
   * @param priceIdentifier Price feed identifier
   * @return aggregator Aggregator associated with price identifier
   */
  function getAggregator(bytes32 priceIdentifier)
    external
    view
    returns (AggregatorV3Interface aggregator);

  /**
   * @notice Get chainlink oracle price in a given round for a given price identifier
   * @param priceIdentifier Price feed identifier
   * @param _roundId Round Id
   * @return price Oracle price
   */
  function getRoundPrice(bytes32 priceIdentifier, uint80 _roundId)
    external
    view
    returns (uint256 price);
}
