// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import {IDiaPriceFeed} from './interfaces/IDiaPriceFeed.sol';
import {ISynthereumDiaPriceFeed} from './interfaces/ISynthereumDiaPriceFeed.sol';
import {AccessControlEnumerable} from '@openzeppelin/contracts/access/AccessControlEnumerable.sol';
import {PreciseUnitMath} from '../../base/utils/PreciseUnitMath.sol';
import {ISynthereumFinder} from '../../core/interfaces/IFinder.sol';
import {SynthereumInterfaces} from '../../core/Constants.sol';

contract SynthereumDiaPriceFeed is
  ISynthereumDiaPriceFeed,
  IAccessControlEnumerable
{
  using PreciseUnitMath for uint256;

  bytes32 public constant MAINTAINER_ROLE = keccak256('Maintainer');

  //Describe role structure
  struct Roles {
    address admin;
    address maintainer;
  }

  //----------------------------------------
  // Storage
  //----------------------------------------

  ISynthereumFinder public immutable synthereumFinder;
  mapping(bytes32 => IDiaPriceFeed) public aggregators;

  //----------------------------------------
  // Events
  //----------------------------------------

  event SetAggregator(bytes32 priceId, address aggregator);
  event RemoveAggregator(bytes32 priceId);

  //----------------------------------------
  // Constructor
  //----------------------------------------
  /**
   * @notice Constructs the SynthereumDiaPriceFeed contract
   * @param _synthereumFinder Synthereum finder contract
   * @param _roles Admin and Mainteiner roles
   */

  constructor(ISynthereumFinder _synthereumFinder, Roles memory _roles) {
    synthereumFinder = _synthereumFinder;
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

  modifier onlyRouter() {
    if (msg.sender != tx.origin) {
      address router = synthereumFinder.getImplementationAddress(
        SynthereumInterfaces.OracleRouter
      );
      require(msg.sender == router, 'Only router');
    }
    _;
  }

  //----------------------------------------
  // External functions
  //----------------------------------------

  /** @notice - Sets a price identifier pointing to a DIA aggregator contract
   * @param _priceIdentifier - The pair represented in bytes32 --> Important: Make sure to always set the pair with a `-` separator (ex: bytes32 of EUR-USD)
   * @param _aggregator - The address of the DIA aggregator for the given pair
   */

  function setAggregator(bytes32 _priceIdentifier, address _aggregator)
    external
    onlyMaintainer
  {
    require(_aggregator != address(0), 'No aggregator set');
    aggregators[_priceIdentifier] = IDaiPriceFeed(_aggregator);
    emit SetAggregator(_priceIdentifier, _aggregator);
  }

  /** @notice - Removes a mapping of a price identifier to a DIA aggregator
   * @param _priceIdentifier - The pair represented in bytes32 --> Important: Make sure to always set the pair with a `-` separator (ex: bytes32 of EUR-USD)
   */

  function removeAggregator(bytes32 _priceIdentifier) external onlyMaintainer {
    require(
      address(aggregators[_priceIdentifier]) != address(0),
      'The identifier does not exist'
    );
    delete aggregators[_priceIdentifier];
    emit RemoveAggregator(_priceIdentifier);
  }

  /** @notice - Retrieves the latest price for a given pair from a DIA aggregator
   * @param _priceIdentifier - The pair represented in bytes32 --> Important: Make sure to always set the pair with a `-` separator (ex: bytes32 of EUR-USD)
   */
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

    IDiaPriceFeed priceFeed = aggregators[_priceIdentifier];
    string memory _diaIdentifier = string(abi.encodePacked(_priceIdentifier));
    (int128 _price, ) = priceFeed.getValue(_diaIdentifier);
    unscaledPrice = uint256(_price);
    value = _scalePrice(unscaledPrice);
  }

  /** @notice - Checks if a price identifier is linked to an existing DIA aggregator
   * @param _priceIdentifier - The pair represented in bytes32 --> Important: Make sure to always set the pair with a `-` separator (ex: bytes32 of EUR-USD)
   */
  function isPriceSupported(bytes32 _priceIdentifier)
    external
    view
    override
    returns (bool isSupported)
  {
    isSupported = pairs[_priceIdentifier].isSupported;
  }

  //----------------------------------------
  // Internal functions
  //----------------------------------------

  /** @notice - Scales the price retrieved from a DIA aggregator to 18 decimals
   * @dev - The value for decimals is hardcoded as DIA aggregators don't have a function to retrieve the decimals and all Forex pairs are set with 8 decimals as per their team response
   * @param _unscaledPrice - The unscaled price returned from the DIA aggregator
   */
  function _scalePrice(uint256 _unscaledPrice)
    internal
    pure
    returns (uint256 price)
  {
    price = _unscaledPrice * (10**(18 - 8));
  }
}
