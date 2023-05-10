// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import {ISynthereumFinder} from '../../core/interfaces/IFinder.sol';
import {IDapiServer} from './interfaces/IDapiServer.sol';
import {SynthereumPriceFeedImplementation} from './PriceFeedImplementation.sol';

/**
 * @title API3 implementation for synthereum price-feed
 */
contract SynthereumApi3PriceFeed is SynthereumPriceFeedImplementation {
  //----------------------------------------
  // Constructor
  //----------------------------------------
  /**
   * @notice Constructs the SynthereumApi3PriceFeed contract
   * @param _synthereumFinder Synthereum finder contract
   * @param _roles Admin and Mainteiner roles
   */
  constructor(ISynthereumFinder _synthereumFinder, Roles memory _roles)
    SynthereumPriceFeedImplementation(_synthereumFinder, _roles)
  {}

  /**
   * @notice Get last API3 oracle price for an input source
   * @param _priceIdentifier Price feed identifier
   * @param _source Source contract from which get the price
   * @return price Price get from the source oracle
   * @return decimals Decimals of the price
   */
  function _getOracleLatestRoundPrice(
    bytes32 _priceIdentifier,
    address _source,
    bytes memory
  ) internal view override returns (uint256 price, uint8 decimals) {
    IDapiServer priceFeed = IDapiServer(_source);
    int224 unconvertedPrice =
      priceFeed.readDataFeedValueWithId(_priceIdentifier);
    require(unconvertedPrice >= 0, 'Negative value');
    price = uint256(uint224(unconvertedPrice));
    decimals = 18;
  }
}
