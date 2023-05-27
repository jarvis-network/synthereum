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

  //----------------------------------------
  // External functions
  //----------------------------------------
  /**
   * @notice Add support for a chainlink pair
   * @notice Only maintainer can call this function
   * @param _priceId Name of the pair identifier
   * @param _kind Type of the pair (standard or reversed)
   * @param _source Contract from which get the price
   * @param _conversionUnit Conversion factor to be applied on price get from source (if 0 no conversion)
   * @param _extraData Extra-data needed for getting the price from source
   */
  function setPair(
    string calldata _priceId,
    Type _kind,
    address _source,
    uint256 _conversionUnit,
    bytes calldata _extraData,
    uint64 _maxSpread
  ) public override {
    super.setPair(
      _priceId,
      _kind,
      _source,
      _conversionUnit,
      _extraData,
      _maxSpread
    );
    require(_maxSpread > 0, 'Max spread can not be dynamic');
  }

  //----------------------------------------
  // Internal view functions
  //----------------------------------------
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

  /**
   * @notice Get the max update spread for a given price identifier from chainlink
   * @param _priceId HexName of price identifier
   * @param _source Source contract from which get the price
   * @param _extraData Extra data of the pair for getting info
   * @return Max spread
   */
  function _getDynamicMaxSpread(
    bytes32 _priceId,
    address _source,
    bytes memory _extraData
  ) internal view virtual override returns (uint64) {
    revert('Dynamic max spread not supported');
  }
}
