// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.6.12;

interface ISynthereumFactoryVersioning {
  function setFactory(
    bytes32 factoryType,
    uint8 version,
    address poolFactory
  ) external;

  function removeFactory(bytes32 factoryType, uint8 version) external;

  function getFactoryVersion(bytes32 factoryType, uint8 version)
    external
    view
    returns (address poolFactory);

  function numberOfVerisonsOfFactory(bytes32 factoryType)
    external
    view
    returns (uint256 numberOfVersions);
}
