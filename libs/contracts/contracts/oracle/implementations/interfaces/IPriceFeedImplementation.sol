// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity >=0.8.0;

interface ISynthereumPriceFeedImplementation {
  /**
   * @notice Get last price for a given price identifier
   * @param _priceId HexName of price identifier
   * @return Oracle price
   */
  function getLatestPrice(bytes32 _priceId) external view returns (uint256);

  /**
   * @notice Return if a price identifier is supported
   * @param _priceId HexName of price identifier
   * @return True fi supporteed, otherwise false
   */
  function isPriceSupported(bytes32 _priceId) external view returns (bool);
}
