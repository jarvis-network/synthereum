// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import {IDapiServer} from './interfaces/IDapiServer.sol';
import {ISynthereumApi3PriceFeed} from './interfaces/IApi3PriceFeed.sol';
import {
  AccessControlEnumerable
} from '@openzeppelin/contracts/access/AccessControlEnumerable.sol';

// TODO DECIMALS
// TODO access modifier
contract DataFeedReaderExample is
  ISynthereumApi3PriceFeed,
  AccessControlEnumerable
{
  using PreciseUnitMath for uint256;

  bytes32 public constant MAINTAINER_ROLE = keccak256('Maintainer');

  //Describe role structure
  struct Roles {
    address admin;
    address maintainer;
  }

  ISynthereumFinder public immutable synthereumFinder;
  mapping(bytes32 => IDapiServer) public servers; //maps priceFeedId to its server contract

  event SetServer(bytes32 priceId, address server);
  event RemoveServer(bytes32 priceId);

  constructor(ISynthereumFinder _synthereumFinder, Roles memory _roles) {
    synthereumFinder = _synthereumFinder;
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

  function setServer(bytes32 _priceIdentifier, address _server)
    external
    onlyMaintainer
  {
    require(_server != address(0), 'No server set');
    servers[_priceIdentifier] = _server;

    emit SetServer(_priceIdentifier, _server);
  }

  function removeServer(bytes32 _priceIdentifier) external onlyMaintainer {
    require(
      servers[_priceIdentifier] != address(0),
      'This identifier does not exist'
    );
    delete servers[_priceIdentifier];

    emit RemoveServer(_priceIdentifier);
  }

  function getLatestPrice(bytes32 _priceIdentifier)
    external
    view
    override
    returns (int224 value, uint256 timestamp)
  {
    require(
      isPriceSupported(_priceIdentifier),
      'Price identifier not supported'
    );

    address dapiServer = servers[_priceIdentifier];
    (value, timestamp) = IDapiServer(dapiServer).readDataFeedWithDapiName(
      _priceIdentifier
    );
  }

  function readDataFeedValueWithDapiName(bytes32 _priceIdentifier)
    external
    view
    returns (int224 value)
  {
    require(
      isPriceSupported(_priceIdentifier),
      'Price identifier not supported'
    );
    address dapiServer = servers[_priceIdentifier];
    value = IDapiServer(dapiServer).readDataFeedValueWithDapiName(
      _priceIdentifier
    );
  }

  function isPriceSupported(bytes32 _priceIdentifier)
    external
    view
    override
    returns (bool isSupported)
  {
    isSupported = servers[_priceIdentifier] != address(0);
  }
}
