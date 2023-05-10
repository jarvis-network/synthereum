pragma solidity >=0.8.0;

interface IDiaPriceFeed {
  function getValue(string memory key) external view returns (uint128, uint128);
}
