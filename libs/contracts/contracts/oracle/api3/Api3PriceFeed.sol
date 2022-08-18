// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import {IDapiServer} from './interfaces/IDapiServer.sol';
import {ISynthereumApi3PriceFeed} from './interfaces/IApi3PriceFeed.sol';
import {
  AccessControlEnumerable
} from '@openzeppelin/contracts/access/AccessControlEnumerable.sol';
import {PreciseUnitMath} from '../../base/utils/PreciseUnitMath.sol';
import {ISynthereumFinder} from '../../core/interfaces/IFinder.sol';
import {SynthereumInterfaces} from '../../core/Constants.sol';

// API3 scales all return values to 18 decimals
contract SynthereumApi3PriceFeed is
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

  modifier onlyRouter() {
    if (msg.sender != tx.origin) {
      address router =
        synthereumFinder.getImplementationAddress(
          SynthereumInterfaces.OracleRouter
        );
      require(msg.sender == router, 'Only router');
    }
    _;
  }

  function setServer(bytes32 _priceIdentifier, address _server)
    external
    onlyMaintainer
  {
    require(_server != address(0), 'No server set');
    servers[_priceIdentifier] = IDapiServer(_server);

    emit SetServer(_priceIdentifier, _server);
  }

  function removeServer(bytes32 _priceIdentifier) external onlyMaintainer {
    require(
      address(servers[_priceIdentifier]) != address(0),
      'This identifier does not exist'
    );
    delete servers[_priceIdentifier];

    emit RemoveServer(_priceIdentifier);
  }

  function getLatestPrice(bytes32 _priceIdentifier)
    external
    view
    override
    onlyRouter
    returns (uint256 value)
  {
    require(
      this.isPriceSupported(_priceIdentifier),
      'Price identifier not supported'
    );

    IDapiServer dapiServer = servers[_priceIdentifier];
    int224 retValue = dapiServer.readDataFeedValueWithId(_priceIdentifier);
    value = uint256(int256(retValue));
  }

  function isPriceSupported(bytes32 _priceIdentifier)
    external
    view
    override
    returns (bool isSupported)
  {
    isSupported = address(servers[_priceIdentifier]) != address(0);
  }
}
