// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity 0.8.9;

import {ISynthereumFinder} from '../../core/interfaces/IFinder.sol';
import {IDiaPriceFeed} from './interfaces/IDiaPriceFeed.sol';
import {StringUtils} from '../../base/utils/StringUtils.sol';
import {SynthereumPriceFeedImplementation} from './PriceFeedImplementation.sol';

/**
 * @title DIA implementation for synthereum price-feed
 */
contract SynthereumDiaPriceFeed is SynthereumPriceFeedImplementation {
  using StringUtils for bytes32;

  //----------------------------------------
  // Constructor
  //----------------------------------------
  /**
   * @notice Constructs the SynthereumDiaPriceFeed contract
   * @param _synthereumFinder Synthereum finder contract
   * @param _roles Admin and Mainteiner roles
   */
  constructor(ISynthereumFinder _synthereumFinder, Roles memory _roles)
    SynthereumPriceFeedImplementation(_synthereumFinder, _roles)
  {}

  /**
   * @notice Get last DIA oracle price for an input source
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
    IDiaPriceFeed priceFeed = IDiaPriceFeed(_source);
    (price, ) = priceFeed.getValue(_priceIdentifier.bytes32ToString());
    decimals = 8;
  }
}
