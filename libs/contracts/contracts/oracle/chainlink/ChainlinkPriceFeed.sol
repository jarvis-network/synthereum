// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.4;

import {ISynthereumFinder} from '../../core/interfaces/IFinder.sol';
import {
  ISynthereumRegistry
} from '../../core/registries/interfaces/IRegistry.sol';
import {ISynthereumDeployment} from '../../common/interfaces/IDeployment.sol';
import {SynthereumInterfaces} from '../../core/Constants.sol';
import {
  ISynthereumChainlinkPriceFeed
} from './interfaces/IChainlinkPriceFeed.sol';
import {ITypology} from '../../common/interfaces/ITypology.sol';
import {
  AggregatorV3Interface
} from '@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol';
import {
  AccessControlEnumerable
} from '@openzeppelin/contracts/access/AccessControlEnumerable.sol';
import 'hardhat/console.sol';

contract SynthereumChainlinkPriceFeed is
  ISynthereumChainlinkPriceFeed,
  AccessControlEnumerable
{
  bytes32 public constant MAINTAINER_ROLE = keccak256('Maintainer');

  //Describe role structure
  struct Roles {
    address admin;
    address maintainer;
  }

  struct Pair {
    bool isSupported;
    Type priceType;
    AggregatorV3Interface aggregator;
    bytes32[] intermediatePairs;
  }

  //----------------------------------------
  // Storage
  //----------------------------------------

  ISynthereumFinder public immutable synthereumFinder;
  mapping(bytes32 => Pair) public pairs;
  //----------------------------------------
  // Events
  //----------------------------------------

  event SetPair(
    bytes32 indexed priceIdentifier,
    Type kind,
    address aggregator,
    bytes32[] intermediatePairs
  );

  event RemovePair(bytes32 indexed priceIdentifier);

  //----------------------------------------
  // Constructor
  //----------------------------------------
  /**
   * @notice Constructs the SynthereumChainlinkPriceFeed contract
   * @param _synthereumFinder Synthereum finder contract
   * @param roles Admin and Mainteiner roles
   */
  constructor(ISynthereumFinder _synthereumFinder, Roles memory roles) {
    synthereumFinder = _synthereumFinder;
    _setRoleAdmin(DEFAULT_ADMIN_ROLE, DEFAULT_ADMIN_ROLE);
    _setRoleAdmin(MAINTAINER_ROLE, DEFAULT_ADMIN_ROLE);
    _setupRole(DEFAULT_ADMIN_ROLE, roles.admin);
    _setupRole(MAINTAINER_ROLE, roles.maintainer);
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

  //----------------------------------------
  // External functions
  //----------------------------------------

  function setPair(
    Type kind,
    bytes32 priceIdentifier,
    address aggregator,
    bytes32[] memory intermediatePairs
  ) external override onlyMaintainer {
    if (kind == Type.INVERSE || kind == Type.STANDARD) {
      require(aggregator != address(0), 'No aggregator set');
      require(
        intermediatePairs.length == 0,
        'No intermediate pairs should be specified'
      );
    } else {
      require(aggregator == address(0), 'Aggregator should not be set');
      require(intermediatePairs.length > 0, 'No intermediate pairs set');
    }

    pairs[priceIdentifier] = Pair(
      true,
      kind,
      AggregatorV3Interface(aggregator),
      intermediatePairs
    );
    emit SetPair(priceIdentifier, kind, aggregator, intermediatePairs);
  }

  function removePair(bytes32 priceIdentifier)
    external
    override
    onlyMaintainer
  {
    require(
      pairs[priceIdentifier].isSupported,
      'Price identifier does not exist'
    );
    delete pairs[priceIdentifier];
    emit RemovePair(priceIdentifier);
  }

  /**
   * @notice Get last chainlink oracle price for a given price identifier
   * @param priceIdentifier Price feed identifier
   * @return price Oracle price
   */
  function getLatestPrice(bytes32 priceIdentifier)
    external
    view
    override
    onlyPoolsOrSelfMinting
    returns (uint256 price)
  {
    price = _getLatestPrice(priceIdentifier);
  }

  /**
   * @notice Get chainlink oracle price in a given round for a given price identifier
   * @param priceIdentifier Price feed identifier
   * @param _roundId Round Id
   * @return price Oracle price
   */
  function getRoundPrice(bytes32 priceIdentifier, uint80 _roundId)
    external
    view
    override
    onlyPoolsOrSelfMinting
    returns (uint256 price)
  {
    Type priceType = pairs[priceIdentifier].priceType;
    require(priceType != Type.COMPUTED, 'Computed price not supported');

    OracleData memory oracleData =
      _getOracleRoundData(priceIdentifier, _roundId);
    price = getScaledValue(oracleData.answer, oracleData.decimals);

    if (priceType == Type.INVERSE) {
      price = 10**36 / price;
    }
  }

  //----------------------------------------
  // Public view functions
  //----------------------------------------

  /**
   * @notice Returns the address of aggregator if exists, otherwise it reverts
   * @param priceIdentifier Price feed identifier
   * @return aggregator Aggregator associated with price identifier
   */
  function getAggregator(bytes32 priceIdentifier)
    public
    view
    override
    returns (AggregatorV3Interface aggregator)
  {
    require(
      pairs[priceIdentifier].isSupported,
      'Price identifier does not exist'
    );
    aggregator = pairs[priceIdentifier].aggregator;
  }

  /**
   * @notice Return if price identifier is supported
   * @param priceIdentifier Price feed identifier
   * @return isSupported True if price is supported otherwise false
   */
  function isPriceSupported(bytes32 priceIdentifier)
    external
    view
    override
    returns (bool isSupported)
  {
    isSupported = pairs[priceIdentifier].isSupported;
  }

  //----------------------------------------
  // Internal view functions
  //----------------------------------------

  /**
   * @notice Calculate a computed price of a specific pair
   * @notice A computed price is obtained by combining prices from separate aggregators
   * @param pair Struct identifying the pair of assets
   * @return price 18 decimals scaled price of the pair
   */
  function getComputedPrice(Pair memory pair)
    internal
    view
    returns (uint256 price)
  {
    bytes32[] memory intermediatePairs = pair.intermediatePairs;

    price = 10**18;
    for (uint8 i = 0; i < intermediatePairs.length; i++) {
      uint256 intermediatePrice = _getLatestPrice(intermediatePairs[i]);
      price = (price * intermediatePrice) / 10**18;
    }
  }

  /**
   * @notice Calculate the inverse price of a given pair
   * @param priceId Price feed identifier
   * @return price 18 decimals scaled price of the pair
   */
  function getInversePrice(bytes32 priceId)
    internal
    view
    returns (uint256 price)
  {
    OracleData memory oracleData = _getOracleLatestRoundData(priceId);
    price = 10**36 / getScaledValue(oracleData.answer, oracleData.decimals);
  }

  /**
   * @notice Get last chainlink oracle data for a given price identifier
   * @param priceIdentifier Price feed identifier
   * @return oracleData Oracle data
   */
  function _getOracleLatestRoundData(bytes32 priceIdentifier)
    internal
    view
    returns (OracleData memory oracleData)
  {
    AggregatorV3Interface aggregator = getAggregator(priceIdentifier);
    (
      uint80 roundId,
      int256 answer,
      uint256 startedAt,
      uint256 updatedAt,
      uint80 answeredInRound
    ) = aggregator.latestRoundData();
    uint8 decimals = aggregator.decimals();
    oracleData = OracleData(
      roundId,
      convertPrice(answer),
      startedAt,
      updatedAt,
      answeredInRound,
      decimals
    );
  }

  /**
   * @notice Get chainlink oracle data in a given round for a given price identifier
   * @param priceIdentifier Price feed identifier
   * @param _roundId Round Id
   * @return oracleData Oracle data
   */
  function _getOracleRoundData(bytes32 priceIdentifier, uint80 _roundId)
    internal
    view
    returns (OracleData memory oracleData)
  {
    AggregatorV3Interface aggregator = getAggregator(priceIdentifier);
    (
      uint80 roundId,
      int256 answer,
      uint256 startedAt,
      uint256 updatedAt,
      uint80 answeredInRound
    ) = aggregator.getRoundData(_roundId);
    uint8 decimals = aggregator.decimals();
    oracleData = OracleData(
      roundId,
      convertPrice(answer),
      startedAt,
      updatedAt,
      answeredInRound,
      decimals
    );
  }

  //----------------------------------------
  // Internal pure functions
  //----------------------------------------
  function _getLatestPrice(bytes32 priceIdentifier)
    internal
    view
    returns (uint256 price)
  {
    Pair memory pair = pairs[priceIdentifier];

    if (pair.priceType == Type.STANDARD) {
      OracleData memory oracleData = _getOracleLatestRoundData(priceIdentifier);
      price = getScaledValue(oracleData.answer, oracleData.decimals);
    } else if (pair.priceType == Type.INVERSE) {
      price = getInversePrice(priceIdentifier);
    } else {
      price = getComputedPrice(pair);
    }
  }

  /**
   * @notice Covert the price from int to uint and it reverts if negative
   * @param uncovertedPrice Price before conversion
   * @return price Price after conversion
   */

  function convertPrice(int256 uncovertedPrice)
    internal
    pure
    returns (uint256 price)
  {
    require(uncovertedPrice >= 0, 'Negative value');
    price = uint256(uncovertedPrice);
  }

  /**
   * @notice Covert the price to a integer with 18 decimals
   * @param unscaledPrice Price before conversion
   * @param decimals Number of decimals of unconverted price
   * @return price Price after conversion
   */

  function getScaledValue(uint256 unscaledPrice, uint8 decimals)
    internal
    pure
    returns (uint256 price)
  {
    price = unscaledPrice * (10**(18 - decimals));
  }
}
