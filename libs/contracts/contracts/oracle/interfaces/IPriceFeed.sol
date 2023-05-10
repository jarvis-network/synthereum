// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity >=0.8.0;

interface ISynthereumPriceFeed {
  /**
   * @notice Get last price for a given price identifier
   * @notice Only registered pools and registered self-minting derivatives can call this function
   * @param _priceId HexName of price identifier
   * @return price Oracle price
   */
  function getLatestPrice(bytes32 _priceId)
    external
    view
    returns (uint256 price);

  /**
   * @notice Return if a price identifier is supported
   * @param _priceId Name of price identifier
   * @return isSupported True fi supporteed, otherwise false
   */
  function isPriceSupported(bytes32 _priceId)
    external
    view
    returns (bool isSupported);
}
