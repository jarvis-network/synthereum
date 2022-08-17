// SPDX-License-_identifier: AGPL-3.0-only
pragma solidity 0.8.9;

import {ISynthereumPriceFeed} from './common/interfaces/IPriceFeed.sol';
import {
  AccessControlEnumerable
} from '@openzeppelin/contracts/access/AccessControlEnumerable.sol';

contract OracleRouter is ISynthereumPriceFeed, AccessControlEnumerable {
  bytes32 public constant MAINTAINER_ROLE = keccak256('Maintainer');

  // maps a price identifier to the oracle contract
  mapping(bytes32 => address) public idToOracle;

  //Describe role structure
  struct Roles {
    address admin;
    address maintainer;
  }

  modifier onlyMaintainer() {
    require(
      hasRole(MAINTAINER_ROLE, msg.sender),
      'Sender must be the maintainer'
    );
    _;
  }

  modifier onlyPoolsOrSelfMinting() {
    if (msg.sender != tx.origin) {
      ISynthereumRegistry registry;
      try ITypology(msg.sender).typology() returns (
        string memory typologyString
      ) {
        bytes32 typology = keccak256(abi.encodePacked(typologyString));
        if (typology == keccak256(abi.encodePacked('POOL'))) {
          registry = ISynthereumRegistry(
            synthereumFinder.getImplementationAddress(
              SynthereumInterfaces.PoolRegistry
            )
          );
        } else if (typology == keccak256(abi.encodePacked('SELF-MINTING'))) {
          registry = ISynthereumRegistry(
            synthereumFinder.getImplementationAddress(
              SynthereumInterfaces.SelfMintingRegistry
            )
          );
        } else {
          revert('Typology not supported');
        }
      } catch {
        registry = ISynthereumRegistry(
          synthereumFinder.getImplementationAddress(
            SynthereumInterfaces.PoolRegistry
          )
        );
      }
      ISynthereumDeployment callingContract = ISynthereumDeployment(msg.sender);
      require(
        registry.isDeployed(
          callingContract.syntheticTokenSymbol(),
          callingContract.collateralToken(),
          callingContract.version(),
          msg.sender
        ),
        'Calling contract not registered'
      );
    }
    _;
  }

  constructor(Roles memory _roles) {
    _setRoleAdmin(DEFAULT_ADMIN_ROLE, DEFAULT_ADMIN_ROLE);
    _setRoleAdmin(MAINTAINER_ROLE, DEFAULT_ADMIN_ROLE);
    _setupRole(DEFAULT_ADMIN_ROLE, _roles.admin);
    _setupRole(MAINTAINER_ROLE, _roles.maintainer);
  }

  function addIdentifier(bytes32 _id, address _oracleContract)
    external
    onlyMaintainer
  {
    idToOracle[_id] = _oracleContract;
  }

  function removeIdentifier(bytes32 _id, address _oracleContract)
    external
    onlyMaintainer
  {
    delete idToOracle[_id];
  }

  function getLatestPrice(bytes32 _priceIdentifier)
    external
    view
    override
    onlyPoolOrSelfMinting
    returns (uint256 price)
  {
    address oracle = idToOracle[_priceIdentifier];
    price = ISynthereumPriceFeed(oracle).getLatestPrice(_priceIdentifier);
  }

  function isPriceSupported(bytes32 _priceIdentifier)
    external
    view
    override
    onlyPoolOrSelfMinting
    returns (bool isSupported)
  {
    address oracle = idToOracle[_priceIdentifier];
    isSupported = ISynthereumPriceFeed(oracle).isPriceSupported(
      _priceIdentifier
    );
  }
}
