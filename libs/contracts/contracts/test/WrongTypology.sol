// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity 0.8.9;

import {ISynthereumPriceFeed} from '../oracle/interfaces/IPriceFeed.sol';

contract WrongTypology {
  string public constant typology = 'WRONG';
  ISynthereumPriceFeed public priceFeed;

  constructor(address _priceFeed) {
    priceFeed = ISynthereumPriceFeed(_priceFeed);
  }

  function getPrice(bytes32 identifier) external view returns (uint256 price) {
    price = priceFeed.getLatestPrice(identifier);
  }
}
