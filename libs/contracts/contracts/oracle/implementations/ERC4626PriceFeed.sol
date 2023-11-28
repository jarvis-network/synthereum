// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity 0.8.9;

import {ISynthereumFinder} from '../../core/interfaces/IFinder.sol';
import {SynthereumPriceFeedImplementation} from './PriceFeedImplementation.sol';
import {IERC4626} from './interfaces/IERC4626.sol';

/**
 * @title Implementation for synthereum price-feed reading from a ERC4626 vault
 */
contract SynthereumERC4626PriceFeed is SynthereumPriceFeedImplementation {
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
   * @notice Add support for a ERC4626 vault
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
   * @notice Get price as vault.convertToAssets(baseUnit)
   * @param _source Source contract (MUST be a 4626 vault) from which get the price
   * @return price Collateral equivalent on 1 share
   * @return decimals Decimals of the conversion
   */
  function _getOracleLatestRoundPrice(
    bytes32,
    address _source,
    bytes memory
  ) internal view override returns (uint256 price, uint8 decimals) {
    IERC4626 vault = IERC4626(_source);
    decimals = vault.decimals();
    uint256 baseUnit = 10**decimals;
    price = vault.convertToAssets(baseUnit);
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
