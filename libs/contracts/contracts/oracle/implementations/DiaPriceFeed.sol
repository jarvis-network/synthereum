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

  //----------------------------------------
  // External functions
  //----------------------------------------
  /**
   * @notice Add support for a DIA pair
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

  /**
   * @notice No dynamic spread supported
   */
  function _getDynamicMaxSpread(
    bytes32,
    address,
    bytes memory
  ) internal view virtual override returns (uint64) {
    revert('Dynamic max spread not supported');
  }
}
