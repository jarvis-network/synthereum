// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity 0.8.9;

import {ISynthereumFinder} from '../../core/interfaces/IFinder.sol';
import {
  AggregatorV3Interface
} from '@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol';
import {SynthereumPriceFeedImplementation} from './PriceFeedImplementation.sol';

/**
 * @title Chainlink implementation for synthereum price-feed
 */
contract SynthereumChainlinkPriceFeed is SynthereumPriceFeedImplementation {
  //----------------------------------------
  // Constructor
  //----------------------------------------
  /**
   * @notice Constructs the SynthereumChainlinkPriceFeed contract
   * @param _synthereumFinder Synthereum finder contract
   * @param _roles Admin and Mainteiner roles
   */
  constructor(ISynthereumFinder _synthereumFinder, Roles memory _roles)
    SynthereumPriceFeedImplementation(_synthereumFinder, _roles)
  {}

  /**
   * @notice Get last chainlink oracle price for an input source
   * @param _source Source contract from which get the price
   * @return price Price get from the source oracle
   * @return decimals Decimals of the price
   */
  function _getOracleLatestRoundPrice(
    bytes32,
    address _source,
    bytes memory
  ) internal view override returns (uint256 price, uint8 decimals) {
    AggregatorV3Interface aggregator = AggregatorV3Interface(_source);
    (, int256 unconvertedPrice, , , ) = aggregator.latestRoundData();
    require(unconvertedPrice >= 0, 'Negative value');
    price = uint256(unconvertedPrice);
    decimals = aggregator.decimals();
  }
}
