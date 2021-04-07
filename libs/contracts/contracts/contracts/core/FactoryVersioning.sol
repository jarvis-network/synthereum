// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import {
  ISynthereumFactoryVersioning
} from './interfaces/IFactoryVersioning.sol';
import {
  EnumerableMap
} from '../../@openzeppelin/contracts/utils/EnumerableMap.sol';
import {
  AccessControl
} from '../../@openzeppelin/contracts/access/AccessControl.sol';

contract SynthereumFactoryVersioning is
  ISynthereumFactoryVersioning,
  AccessControl
{
  using EnumerableMap for EnumerableMap.UintToAddressMap;

  bytes32 public constant MAINTAINER_ROLE = keccak256('Maintainer');

  struct Roles {
    address admin;
    address maintainer;
  }

  EnumerableMap.UintToAddressMap private _poolsFactory;

  EnumerableMap.UintToAddressMap private _derivativeFactory;

  EnumerableMap.UintToAddressMap private _selfMintingFactory;

  event AddPoolFactory(uint8 indexed version, address indexed poolFactory);

  event SetPoolFactory(uint8 indexed version, address indexed poolFactory);

  event RemovePoolFactory(uint8 indexed version, address indexed poolFactory);

  event AddDerivativeFactory(
    uint8 indexed version,
    address indexed derivativeFactory
  );

  event SetDerivativeFactory(
    uint8 indexed version,
    address indexed derivativeFactory
  );

  event RemoveDerivativeFactory(
    uint8 indexed version,
    address indexed derivativeFactory
  );

  event AddSelfMintingFactory(
    uint8 indexed version,
    address indexed selfMintingFactory
  );

  event SetSelfMintingFactory(
    uint8 indexed version,
    address indexed selfMintingFactory
  );

  event RemoveSelfMintingFactory(
    uint8 indexed version,
    address indexed selfMintingFactory
  );

  constructor(Roles memory _roles) public {
    _setRoleAdmin(DEFAULT_ADMIN_ROLE, DEFAULT_ADMIN_ROLE);
    _setRoleAdmin(MAINTAINER_ROLE, DEFAULT_ADMIN_ROLE);
    _setupRole(DEFAULT_ADMIN_ROLE, _roles.admin);
    _setupRole(MAINTAINER_ROLE, _roles.maintainer);
  }

  modifier onlyMaintainer() {
    require(
      hasRole(MAINTAINER_ROLE, msg.sender),
      'Sender must be the maintainer'
    );
    _;
  }

  function setPoolFactory(uint8 version, address poolFactory)
    external
    override
    onlyMaintainer
  {
    require(poolFactory != address(0), 'Pool factory cannot be address 0');
    bool isNewVersion = _poolsFactory.set(version, poolFactory);
    if (isNewVersion == true) {
      emit AddPoolFactory(version, poolFactory);
    } else {
      emit SetPoolFactory(version, poolFactory);
    }
  }

  function removePoolFactory(uint8 version) external override onlyMaintainer {
    address poolFactoryToRemove = _poolsFactory.get(version);
    _poolsFactory.remove(version);
    RemovePoolFactory(version, poolFactoryToRemove);
  }

  function setDerivativeFactory(uint8 version, address derivativeFactory)
    external
    override
    onlyMaintainer
  {
    require(
      derivativeFactory != address(0),
      'Derivative factory cannot be address 0'
    );
    bool isNewVersion = _derivativeFactory.set(version, derivativeFactory);
    if (isNewVersion == true) {
      emit AddDerivativeFactory(version, derivativeFactory);
    } else {
      emit SetDerivativeFactory(version, derivativeFactory);
    }
  }

  function removeDerivativeFactory(uint8 version)
    external
    override
    onlyMaintainer
  {
    address derivativeFactoryToRemove = _derivativeFactory.get(version);
    _derivativeFactory.remove(version);
    emit RemoveDerivativeFactory(version, derivativeFactoryToRemove);
  }

  function setSelfMintingFactory(uint8 version, address selfMintingFactory)
    external
    override
    onlyMaintainer
  {
    require(
      selfMintingFactory != address(0),
      'Self-minting factory cannot be address 0'
    );
    bool isNewVersion = _selfMintingFactory.set(version, selfMintingFactory);
    if (isNewVersion == true) {
      emit AddSelfMintingFactory(version, selfMintingFactory);
    } else {
      emit SetSelfMintingFactory(version, selfMintingFactory);
    }
  }

  function removeSelfMintingFactory(uint8 version)
    external
    override
    onlyMaintainer
  {
    address selfMintingFactoryToRemove = _selfMintingFactory.get(version);
    _selfMintingFactory.remove(version);
    emit RemoveSelfMintingFactory(version, selfMintingFactoryToRemove);
  }

  function getPoolFactoryVersion(uint8 version)
    external
    view
    override
    returns (address poolFactory)
  {
    poolFactory = _poolsFactory.get(version);
  }

  function numberOfVerisonsOfPoolFactory()
    external
    view
    override
    returns (uint256 numberOfVersions)
  {
    numberOfVersions = _poolsFactory.length();
  }

  function getDerivativeFactoryVersion(uint8 version)
    external
    view
    override
    returns (address derivativeFactory)
  {
    derivativeFactory = _derivativeFactory.get(version);
  }

  function numberOfVerisonsOfDerivativeFactory()
    external
    view
    override
    returns (uint256 numberOfVersions)
  {
    numberOfVersions = _derivativeFactory.length();
  }

  function getSelfMintingFactoryVersion(uint8 version)
    external
    view
    override
    returns (address selfMintingFactory)
  {
    selfMintingFactory = _selfMintingFactory.get(version);
  }

  function numberOfVerisonsOfSelfMintingFactory()
    external
    view
    override
    returns (uint256 numberOfVersions)
  {
    numberOfVersions = _selfMintingFactory.length();
  }
}
