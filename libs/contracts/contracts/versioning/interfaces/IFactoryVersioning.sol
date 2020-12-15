// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.6.12;

/**
 * @title Provides addresses of different versions of pools factory and derivative factory
 */
interface ISynthereumFactoryVersioning {
  /**
   * @notice Set the address of a version of a pool factory
   * @param version uint8 of the version index
   * @param poolFactory address of the pool factory
   */
  function setPoolFactory(uint8 version, address poolFactory) external;

  /**
   * @notice Remove the address of a version of a pool factory
   * @param version uint8 of the version index
   */
  function removePoolFactory(uint8 version) external;

  /**
   * @notice Set the address of a version of a perpetual derivative factory
   * @param version uint8 of the version index
   * @param derivativeFactory address of the pool factory
   */
  function setDerivativeFactory(uint8 version, address derivativeFactory)
    external;

  /**
   * @notice Remove the address of a version of a perpetual derivative factory
   * @param version uint8 of the version index
   */
  function removeDerivativeFactory(uint8 version) external;

  /**
   * @notice Returns the address of a version of pool factory if exists, otherwise revert
   * @param version uint8 of the version index
   */
  function getPoolFactoryVersion(uint8 version) external view returns (address);

  /**
   * @notice Returns the number of existing versions of pool factory
   */
  function numberOfVerisonsOfPoolFactory() external view returns (uint256);

  /**
   * @notice Returns the address of a version of perpetual derivative factory if exists, otherwise revert
   * @param version uint8 of the version index
   */
  function getDerivativeFactoryVersion(uint8 version)
    external
    view
    returns (address);

  /**
   * @notice Returns the number of existing versions of perpetual derivative factory
   */
  function numberOfVerisonsOfDerivativeFactory()
    external
    view
    returns (uint256);
}
