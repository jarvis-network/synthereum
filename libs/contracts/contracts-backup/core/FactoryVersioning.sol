// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import {
  ISynthereumFactoryVersioning
} from './interfaces/IFactoryVersioning.sol';
import {EnumerableMap} from '@openzeppelin/contracts/utils/EnumerableMap.sol';
import {AccessControl} from '@openzeppelin/contracts/access/AccessControl.sol';

/**
 * @title Provides addresses of different versions of pools factory and derivative factory
 */
contract SynthereumFactoryVersioning is
  ISynthereumFactoryVersioning,
  AccessControl
{
  using EnumerableMap for EnumerableMap.UintToAddressMap;

  bytes32 public constant MAINTAINER_ROLE = keccak256('Maintainer');

  //Describe role structure
  struct Roles {
    address admin;
    address maintainer;
  }

  //Map vith key index version and value the address of pool factory
  EnumerableMap.UintToAddressMap private _poolsFactory;

  //Map vith key index version and value the address of perpetual derivative factory
  EnumerableMap.UintToAddressMap private _derivativeFactory;

  //----------------------------------------
  // Events
  //----------------------------------------

  event AddPoolFactory(uint8 indexed version, address poolFactory);

  event RemovePoolFactory(uint8 indexed version);

  event AddDerivativeFactory(uint8 indexed version, address derivativeFactory);

  event RemoveDerivativeFactory(uint8 indexed version);

  //----------------------------------------
  // Constructor
  //----------------------------------------

  constructor(Roles memory _roles) public {
    _setRoleAdmin(DEFAULT_ADMIN_ROLE, DEFAULT_ADMIN_ROLE);
    _setRoleAdmin(MAINTAINER_ROLE, DEFAULT_ADMIN_ROLE);
    _setupRole(DEFAULT_ADMIN_ROLE, _roles.admin);
    _setupRole(MAINTAINER_ROLE, _roles.maintainer);
  }

  //----------------------------------------
  // Modifiers
  //----------------------------------------

  modifier onlyMaintainer() {
    require(
      hasRole(MAINTAINER_ROLE, msg.sender),
      'Sender must be the maintainer'
    );
    _;
  }

  //----------------------------------------
  // External functions
  //----------------------------------------

  /**
   * @notice Set the address of a version of a pool factory
   * @param version uint8 of the version index
   * @param poolFactory address of the pool factory
   */
  function setPoolFactory(uint8 version, address poolFactory)
    external
    override
    onlyMaintainer
  {
    _poolsFactory.set(version, poolFactory);
    emit AddPoolFactory(version, poolFactory);
  }

  /**
   * @notice Removes the address of a version of a pool factory
   * @param version uint8 of the version index
   */
  function removePoolFactory(uint8 version) external override onlyMaintainer {
    require(
      _poolsFactory.remove(version),
      'Version of the pool factory does not exist'
    );
    emit RemovePoolFactory(version);
  }

  /**
   * @notice Set the address of a version of a perpetual derivative factory
   * @param version uint8 of the version index
   * @param derivativeFactory address of the perpetual derivative factory
   */
  function setDerivativeFactory(uint8 version, address derivativeFactory)
    external
    override
    onlyMaintainer
  {
    _derivativeFactory.set(version, derivativeFactory);
    emit AddDerivativeFactory(version, derivativeFactory);
  }

  /**
   * @notice Removes the address of a version of a perpetual derivative factory
   * @param version uint8 of the version index
   */
  function removeDerivativeFactory(uint8 version)
    external
    override
    onlyMaintainer
  {
    require(
      _derivativeFactory.remove(version),
      'Version of the pool factory does not exist'
    );
    emit RemoveDerivativeFactory(version);
  }

  //----------------------------------------
  // External view functions
  //----------------------------------------

  /**
   * @notice Returns the address of a version of pool factory if it exists, otherwise reverts
   * @param version uint8 of the version index
   */
  function getPoolFactoryVersion(uint8 version)
    external
    view
    override
    returns (address poolFactory)
  {
    poolFactory = _poolsFactory.get(version);
  }

  /**
   * @notice Returns the number of existing versions of pool factory
   */
  function numberOfVerisonsOfPoolFactory()
    external
    view
    override
    returns (uint256 numberOfVersions)
  {
    numberOfVersions = _poolsFactory.length();
  }

  /**
   * @notice Returns the address of a version of perpetual derivative factory if it exists, otherwise reverts
   * @param version uint8 of the version index
   */
  function getDerivativeFactoryVersion(uint8 version)
    external
    view
    override
    returns (address derivativeFactory)
  {
    derivativeFactory = _derivativeFactory.get(version);
  }

  /**
   * @notice Returns the number of existing versions of perpetual derivative factory
   */
  function numberOfVerisonsOfDerivativeFactory()
    external
    view
    override
    returns (uint256 numberOfVersions)
  {
    numberOfVersions = _derivativeFactory.length();
  }
}
