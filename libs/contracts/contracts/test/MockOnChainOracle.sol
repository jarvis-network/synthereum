pragma solidity ^0.8.4;

contract MockOnChainOracle {
  mapping(bytes32 => uint256) idToPrice;

  function getLatestPrice(bytes32 identifier)
    external
    view
    returns (uint256 price)
  {
    price = idToPrice[identifier];
  }

  function setPrice(bytes32 identifier, uint256 price) external {
    idToPrice[identifier] = price;
  }
}
