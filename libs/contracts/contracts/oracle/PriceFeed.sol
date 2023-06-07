// SPDX-License-_identifier: AGPL-3.0-only
pragma solidity 0.8.9;

import {ISynthereumPriceFeed} from './interfaces/IPriceFeed.sol';
import {ISynthereumFinder} from '../core/interfaces/IFinder.sol';
import {ISynthereumRegistry} from '../core/registries/interfaces/IRegistry.sol';
import {ISynthereumDeployment} from '../common/interfaces/IDeployment.sol';
import {ITypology} from '../common/interfaces/ITypology.sol';
import {SynthereumInterfaces} from '../core/Constants.sol';
import {PreciseUnitMath} from '../base/utils/PreciseUnitMath.sol';
import {EnumerableSet} from '@openzeppelin/contracts/utils/structs/EnumerableSet.sol';
import {Address} from '@openzeppelin/contracts/utils/Address.sol';
import {StringUtils} from '../base/utils/StringUtils.sol';
import {StandardAccessControlEnumerable} from '../common/roles/StandardAccessControlEnumerable.sol';

/**
 * @title Synthereum price-feed contract for multi-protocol support
 */
contract SynthereumPriceFeed is
  ISynthereumPriceFeed,
  StandardAccessControlEnumerable
{
  using EnumerableSet for EnumerableSet.Bytes32Set;
  using Address for address;
  using StringUtils for string;
  using StringUtils for bytes32;
  using PreciseUnitMath for uint256;

  enum Type {
    UNSUPPORTED,
    STANDARD,
    COMPUTED
  }

  struct Pair {
    Type priceType;
    bytes32 oracle;
    bytes32[] intermediatePairs;
  }

  struct PairOutput {
    Type priceType;
    string oracle;
    string[] intermediatePairs;
  }

  //----------------------------------------
  // Storage
  //----------------------------------------
  ISynthereumFinder public immutable synthereumFinder;
  EnumerableSet.Bytes32Set private oracles;
  EnumerableSet.Bytes32Set private identifiers;
  mapping(bytes32 => address) private oracleToImplementation;
  mapping(bytes32 => Pair) private pairs;

  //----------------------------------------
  // Events
  //----------------------------------------
  event OracleAdded(bytes32 indexed priceId, address indexed oracleContract);
  event OracleUpdated(bytes32 indexed priceId, address indexed oracleContract);
  event OracleRemoved(bytes32 indexed priceId);
  event PairSet(
    bytes32 indexed priceId,
    Type indexed kind,
    bytes32 oracle,
    bytes32[] intermediatePairs
  );
  event PairRemoved(bytes32 indexed priceId);

  //----------------------------------------
  // Modifiers
  //----------------------------------------
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

  modifier onlyCall() {
    require(msg.sender == tx.origin, 'Only off-chain call');
    _;
  }

  //----------------------------------------
  // Constructor
  //----------------------------------------
  /**
   * @notice Constructs the SynthereumPriceFeed contract
   * @param _synthereumFinder Synthereum finder contract
   * @param _roles Admin and Mainteiner roles
   */
  constructor(ISynthereumFinder _synthereumFinder, Roles memory _roles) {
    synthereumFinder = _synthereumFinder;
    _setAdmin(_roles.admin);
    _setMaintainer(_roles.maintainer);
  }

  //----------------------------------------
  // External functions
  //----------------------------------------
  /**
   * @notice Add support for an oracle protocol
   * @notice Only maintainer can call this function
   * @param _oracle Name of the oracle protocol
   * @param _moduleImpl Address of the sythereum implementation of the oracle
   */
  function addOracle(string calldata _oracle, address _moduleImpl)
    external
    onlyMaintainer
  {
    bytes32 oracleNameHex = _oracle.stringToBytes32();
    require(_moduleImpl.isContract(), 'Implementation is not a contract');
    require(oracles.add(oracleNameHex), 'Oracle already added');
    oracleToImplementation[oracleNameHex] = _moduleImpl;
    emit OracleAdded(oracleNameHex, _moduleImpl);
  }

  /**
   * @notice Update a supported oracle protocol
   * @notice Only maintainer can call this function
   * @param _oracle Name of the oracle protocol
   * @param _moduleImpl Address of the sythereum implementation of the oracle
   */
  function updateOracle(string calldata _oracle, address _moduleImpl)
    external
    onlyMaintainer
  {
    bytes32 oracleNameHex = _oracle.stringToBytes32();
    require(_moduleImpl.isContract(), 'Implementation is not a contract');
    require(oracles.contains(oracleNameHex), 'Oracle not added');
    require(
      oracleToImplementation[oracleNameHex] != _moduleImpl,
      'Same implementation set'
    );
    oracleToImplementation[oracleNameHex] = _moduleImpl;
    emit OracleUpdated(oracleNameHex, _moduleImpl);
  }

  /**
   * @notice Remove an oracle protocol
   * @notice Only maintainer can call this function
   * @param _oracle Name of the oracle protocol
   */
  function removeOracle(string calldata _oracle) external onlyMaintainer {
    bytes32 oracleNameHex = _oracle.stringToBytes32();
    require(oracles.remove(oracleNameHex), 'Oracle not supported');
    delete oracleToImplementation[oracleNameHex];
    emit OracleRemoved(oracleNameHex);
  }

  /**
   * @notice Add support for a pair
   * @notice Only maintainer can call this function
   * @param _priceId Name of the pair identifier
   * @param _kind Type of the pair (standard or computed)
   * @param _oracle Name of the oracle protocol (if standard)
   * @param _intermediatePairs Path with pair names (if computed)
   */
  function setPair(
    string calldata _priceId,
    Type _kind,
    string calldata _oracle,
    string[] calldata _intermediatePairs
  ) external onlyMaintainer {
    bytes32 priceIdentifierHex = _priceId.stringToBytes32();
    require(priceIdentifierHex != 0x0, 'Null identifier');
    bytes32 oracleHex = _oracle.stringToBytes32();
    uint256 intermediatePairsNumber = _intermediatePairs.length;
    bytes32[] memory intermediatePairsHex = new bytes32[](
      intermediatePairsNumber
    );
    for (uint256 j = 0; j < intermediatePairsNumber; ) {
      intermediatePairsHex[j] = _intermediatePairs[j].stringToBytes32();
      unchecked {
        j++;
      }
    }
    _checkPair(
      priceIdentifierHex,
      _kind,
      oracleHex,
      intermediatePairsHex,
      intermediatePairsNumber
    );
    identifiers.add(priceIdentifierHex);
    pairs[priceIdentifierHex] = Pair(_kind, oracleHex, intermediatePairsHex);
    emit PairSet(priceIdentifierHex, _kind, oracleHex, intermediatePairsHex);
  }

  /**
   * @notice Remove support for a pair
   * @notice Only maintainer can call this function
   * @param _priceId Name of the pair identifier
   */
  function removePair(string calldata _priceId) external onlyMaintainer {
    bytes32 priceIdentifierHex = _priceId.stringToBytes32();
    require(identifiers.remove(priceIdentifierHex), 'Identifier not supported');
    delete pairs[priceIdentifierHex];
    emit PairRemoved(priceIdentifierHex);
  }

  //----------------------------------------
  // External view functions
  //----------------------------------------
  /**
   * @notice Get list of the supported oracles
   * @return List of names of the supported oracles
   */
  function getOracles() external view returns (string[] memory) {
    uint256 oracleNumber = oracles.length();
    string[] memory oracleList = new string[](oracleNumber);
    for (uint256 j = 0; j < oracleNumber; ) {
      oracleList[j] = oracles.at(j).bytes32ToString();
      unchecked {
        j++;
      }
    }
    return oracleList;
  }

  /**
   * @notice Get list of the supported identifiers for pairs
   * @return List of names of the supported identifiers
   */
  function getIdentifiers() external view returns (string[] memory) {
    uint256 identifierNumber = identifiers.length();
    string[] memory identifierList = new string[](identifierNumber);
    for (uint256 j = 0; j < identifierNumber; ) {
      identifierList[j] = identifiers.at(j).bytes32ToString();
      unchecked {
        j++;
      }
    }
    return identifierList;
  }

  /**
   * @notice Get the address of the synthereum oracle implemantation for a given oracle, revert if not supported
   * @param _oracle HexName of the oracle protocol
   * @return Address of the implementation
   */
  function oracleImplementation(bytes32 _oracle)
    external
    view
    returns (address)
  {
    return _oracleImplementation(_oracle);
  }

  /**
   * @notice Get the address of the synthereum oracle implemantation for a given oracle, revert if not supported
   * @param _oracle Name of the oracle protocol
   * @return Address of the implementation
   */
  function oracleImplementation(string calldata _oracle)
    external
    view
    returns (address)
  {
    return _oracleImplementation(_oracle.stringToBytes32());
  }

  /**
   * @notice Get the pair data for a given pair identifier, revert if not supported
   * @param _identifier HexName of the pair identifier
   * @return Pair data
   */
  function pair(bytes32 _identifier) external view returns (PairOutput memory) {
    return _pair(_identifier);
  }

  /**
   * @notice Get the pair data for a given pair identifier, revert if not supported
   * @param _identifier Name of the pair identifier
   * @return Pair data
   */
  function pair(string calldata _identifier)
    external
    view
    returns (PairOutput memory)
  {
    return _pair(_identifier.stringToBytes32());
  }

  /**
   * @notice Return if a price identifier is supported
   * @param _priceId HexName of price identifier
   * @return True fi supported, otherwise false
   */
  function isPriceSupported(bytes32 _priceId) external view returns (bool) {
    return _isPriceSupported(_priceId);
  }

  /**
   * @notice Return if a price identifier is supported
   * @param _priceId Name of price identifier
   * @return True fi supported, otherwise false
   */
  function isPriceSupported(string calldata _priceId)
    external
    view
    returns (bool)
  {
    return _isPriceSupported(_priceId.stringToBytes32());
  }

  /**
   * @notice Get last price for a given price identifier
   * @notice Only registered pools, registered self-minting derivatives and off-chain calls can call this function
   * @param _priceId HexName of price identifier
   * @return Oracle price
   */
  function getLatestPrice(bytes32 _priceId)
    external
    view
    onlyPoolsOrSelfMinting
    returns (uint256)
  {
    return _getLatestPrice(_priceId);
  }

  /**
   * @notice Get last price for a given price identifier
   * @notice This function can be called just for off-chain use
   * @param _priceId Name of price identifier
   * @return Oracle price
   */
  function getLatestPrice(string calldata _priceId)
    external
    view
    onlyCall
    returns (uint256)
  {
    return _getLatestPrice(_priceId.stringToBytes32());
  }

  /**
   * @notice Get last prices for a given list of price identifiers
   * @notice Only registered pools, registered self-minting derivatives and off-chain calls can call this function
   * @param _priceIdentifiers List containing HexNames of price identifiers
   * @return Oracle prices
   */
  function getLatestPrices(bytes32[] calldata _priceIdentifiers)
    external
    view
    onlyPoolsOrSelfMinting
    returns (uint256[] memory)
  {
    uint256 identifiersNumber = _priceIdentifiers.length;
    uint256[] memory prices = new uint256[](identifiersNumber);
    for (uint256 j = 0; j < identifiersNumber; ) {
      prices[j] = _getLatestPrice(_priceIdentifiers[j]);
      unchecked {
        j++;
      }
    }
    return prices;
  }

  /**
   * @notice Get last prices for a given list of price identifiers
   * @notice This function can be called just for off-chain use
   * @param _priceIdentifiers List containing names of price identifiers
   * @return Oracle prices
   */
  function getLatestPrices(string[] calldata _priceIdentifiers)
    external
    view
    onlyCall
    returns (uint256[] memory)
  {
    uint256 identifiersNumber = _priceIdentifiers.length;
    uint256[] memory prices = new uint256[](identifiersNumber);
    for (uint256 j = 0; j < identifiersNumber; ) {
      prices[j] = _getLatestPrice(_priceIdentifiers[j].stringToBytes32());
      unchecked {
        j++;
      }
    }
    return prices;
  }

  /**
   * @notice Get the max update spread for a given price identifier
   * @param _priceId HexName of price identifier
   * @return Max spread
   */
  function getMaxSpread(bytes32 _priceId)
    external
    view
    override
    returns (uint256)
  {
    return _getMaxSpread(_priceId);
  }

  /**
   * @notice Get the max update spread for a given price identifier
   * @param _priceId Name of price identifier
   * @return Max spread
   */
  function getMaxSpread(string calldata _priceId)
    external
    view
    returns (uint256)
  {
    return _getMaxSpread(_priceId.stringToBytes32());
  }

  //----------------------------------------
  // Internal view functions
  //----------------------------------------
  /**
   * @notice Check support conditions for a pair
   * @param _priceIdHex Name of the pair identifier
   * @param _kind Type of the pair (standard or computed)
   * @param _oracleHex HexName of the oracle protocol (if standard)
   * @param _intermediatePairsHex Path with pair HexNames (if computed)
   * @param _intermediatePairsNumber Number of elements in _intermediatePairs
   */
  function _checkPair(
    bytes32 _priceIdHex,
    Type _kind,
    bytes32 _oracleHex,
    bytes32[] memory _intermediatePairsHex,
    uint256 _intermediatePairsNumber
  ) internal view {
    if (_kind == Type.STANDARD) {
      require(
        _intermediatePairsHex.length == 0,
        'No intermediate pairs should be specified'
      );
      require(
        oracleToImplementation[_oracleHex] != address(0),
        'Oracle not supported'
      );
      require(
        ISynthereumPriceFeed(oracleToImplementation[_oracleHex])
          .isPriceSupported(_priceIdHex),
        'Price not supported by implementation'
      );
    } else if (_kind == Type.COMPUTED) {
      require(_oracleHex == 0x0, 'Oracle must not be set');
      require(_intermediatePairsNumber > 1, 'No intermediate pairs set');
      bytes32 intermediatePairHex;
      for (uint256 j = 0; j < _intermediatePairsNumber; ) {
        intermediatePairHex = _intermediatePairsHex[j];
        _checkPair(
          intermediatePairHex,
          pairs[intermediatePairHex].priceType,
          pairs[intermediatePairHex].oracle,
          pairs[intermediatePairHex].intermediatePairs,
          pairs[intermediatePairHex].intermediatePairs.length
        );
        unchecked {
          j++;
        }
      }
    } else {
      revert('No type passed');
    }
  }

  /**
   * @notice Get the address of the synthereum oracle implemantation for a given oracle, revert if not supported
   * @param _oracle HexName of the oracle protocol
   * @return implementation Address of the implementation
   */
  function _oracleImplementation(bytes32 _oracle)
    internal
    view
    returns (address implementation)
  {
    implementation = oracleToImplementation[_oracle];
    require(implementation != address(0), 'Oracle not supported');
  }

  /**
   * @notice Get the pair data for a given pair identifier, revert if not supported
   * @param _identifier HexName of the pair identifier
   * @return Pair data
   */
  function _pair(bytes32 _identifier)
    internal
    view
    returns (PairOutput memory)
  {
    Pair storage pairHex = pairs[_identifier];
    PairOutput memory pairData;
    pairData.priceType = pairHex.priceType;
    require(pairData.priceType != Type.UNSUPPORTED, 'Pair not supported');
    pairData.oracle = pairHex.oracle.bytes32ToString();
    uint256 intermediatePairsNumber = pairHex.intermediatePairs.length;
    pairData.intermediatePairs = new string[](intermediatePairsNumber);
    for (uint256 j = 0; j < intermediatePairsNumber; ) {
      pairData.intermediatePairs[j] = pairHex
        .intermediatePairs[j]
        .bytes32ToString();
      unchecked {
        j++;
      }
    }
    return pairData;
  }

  /**
   * @notice Return if a price identifier is supported
   * @param _priceId HexName of price identifier
   * @return isSupported True fi supported, otherwise false
   */
  function _isPriceSupported(bytes32 _priceId)
    internal
    view
    returns (bool isSupported)
  {
    if (pairs[_priceId].priceType == Type.STANDARD) {
      address implementation = oracleToImplementation[pairs[_priceId].oracle];
      if (
        implementation != address(0) &&
        ISynthereumPriceFeed(implementation).isPriceSupported(_priceId)
      ) {
        isSupported = true;
      }
    } else if (pairs[_priceId].priceType == Type.COMPUTED) {
      uint256 pairsNumber = pairs[_priceId].intermediatePairs.length;
      for (uint256 j = 0; j < pairsNumber; ) {
        if (!_isPriceSupported(pairs[_priceId].intermediatePairs[j])) {
          return false;
        }
        unchecked {
          j++;
        }
      }
      isSupported = true;
    } else {
      isSupported = false;
    }
  }

  /**
   * @notice Get last price for a given price identifier
   * @param _priceId HexName of price identifier
   * @return Oracle price
   */
  function _getLatestPrice(bytes32 _priceId) internal view returns (uint256) {
    Type priceType = pairs[_priceId].priceType;
    if (priceType == Type.STANDARD) {
      return
        _getStandardPrice(
          _priceId,
          oracleToImplementation[pairs[_priceId].oracle]
        );
    } else if (priceType == Type.COMPUTED) {
      return _getComputedPrice(pairs[_priceId].intermediatePairs);
    } else {
      revert('Pair not supported');
    }
  }

  /**
   * @notice Retrieve the price of a given standard pair
   * @param _priceId HexName of price identifier
   * @param _oracleImpl Synthereum implementation of the oracle
   * @return 18 decimals scaled price of the pair
   */
  function _getStandardPrice(bytes32 _priceId, address _oracleImpl)
    internal
    view
    returns (uint256)
  {
    return ISynthereumPriceFeed(_oracleImpl).getLatestPrice(_priceId);
  }

  /**
   * @notice Retrieve the price of a given computed pair
   * @param _intermediatePairs Path with pair HexNames
   * @return price 18 decimals scaled price of the pair
   */
  function _getComputedPrice(bytes32[] memory _intermediatePairs)
    internal
    view
    returns (uint256 price)
  {
    price = PreciseUnitMath.PRECISE_UNIT;
    for (uint256 j = 0; j < _intermediatePairs.length; ) {
      price = price.mul(_getLatestPrice(_intermediatePairs[j]));
      unchecked {
        j++;
      }
    }
  }

  /**
   * @notice Get the max update spread for a given price identifier
   * @param _priceId HexName of price identifier
   * @return Max spread
   */
  function _getMaxSpread(bytes32 _priceId) internal view returns (uint256) {
    Type priceType = pairs[_priceId].priceType;
    if (priceType == Type.STANDARD) {
      return
        _getStandardMaxSpread(
          _priceId,
          oracleToImplementation[pairs[_priceId].oracle]
        );
    } else if (priceType == Type.COMPUTED) {
      return _getComputedMaxSpread(pairs[_priceId].intermediatePairs);
    } else {
      revert('Pair not supported');
    }
  }

  /**
   * @notice Get the max update spread for a given standard price identifier
   * @param _oracleImpl Synthereum implementation of the oracle
   * @return Max spread
   */
  function _getStandardMaxSpread(bytes32 _priceId, address _oracleImpl)
    internal
    view
    returns (uint256)
  {
    return uint256(ISynthereumPriceFeed(_oracleImpl).getMaxSpread(_priceId));
  }

  /**
   * @notice Get the max update spread for a given computed price identifier
   * @param _intermediatePairs Path with pair HexNames
   * @return price 18 decimals scaled price of the pair
   */
  function _getComputedMaxSpread(bytes32[] memory _intermediatePairs)
    internal
    view
    returns (uint256)
  {
    uint256 reducedValue = PreciseUnitMath.PRECISE_UNIT;
    for (uint256 j = 0; j < _intermediatePairs.length; ) {
      reducedValue = reducedValue.mul(
        PreciseUnitMath.PRECISE_UNIT -
          uint256(_getMaxSpread(_intermediatePairs[j]))
      );
      unchecked {
        j++;
      }
    }
    return PreciseUnitMath.PRECISE_UNIT - reducedValue;
  }
}
