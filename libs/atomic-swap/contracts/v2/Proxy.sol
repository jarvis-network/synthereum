// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;
pragma experimental ABIEncoderV2;

import {
  ISynthereumPoolOnChainPriceFeed
} from '@jarvis-network/synthereum-contracts/contracts/synthereum-pool/v4/interfaces/IPoolOnChainPriceFeed.sol';
import {
  ISynthereumFinder
} from '@jarvis-network/synthereum-contracts/contracts/core/interfaces/IFinder.sol';

import {
  AccessControlEnumerable
} from '@openzeppelin/contracts/access/AccessControlEnumerable.sol';
import {Address} from '@openzeppelin/contracts/utils/Address.sol';
import {IAtomicSwapProxy} from './interfaces/IProxy.sol';

contract AtomicSwapProxy is IAtomicSwapProxy, AccessControlEnumerable {
  using Address for address;

  // id is sha3(stringID) ie sha3('sushi'), sha3('uniV2') and so on
  // that means only one implementation for each specific dex can exist
  // on UI side, by fixing the identifiers string no fix needs to be done in case on implementations address change
  mapping(bytes32 => address) public idToAddress;

  mapping(address => bytes) public dexImplementationInfo;

  bytes32 public constant MAINTAINER_ROLE = keccak256('Maintainer');

  ISynthereumFinder immutable synthereumFinder;

  event RegisterImplementation(
    string id,
    address previous,
    address implementation,
    bytes info
  );
  event RemovedImplementation(string id);
  event Swap(
    address inputToken,
    address outputToken,
    address collateralToken,
    uint256 inputAmount,
    uint256 outputAmount,
    uint256 collateralAmountRefunded,
    address dexImplementationAddress
  );
  modifier onlyMaintainer() {
    require(
      hasRole(MAINTAINER_ROLE, msg.sender),
      'Only contract maintainer can call this function'
    );
    _;
  }

  constructor(Roles memory _roles, address _synthereumFinderAddress) {
    synthereumFinder = ISynthereumFinder(_synthereumFinderAddress);

    _setRoleAdmin(DEFAULT_ADMIN_ROLE, DEFAULT_ADMIN_ROLE);
    _setRoleAdmin(MAINTAINER_ROLE, DEFAULT_ADMIN_ROLE);

    _setupRole(DEFAULT_ADMIN_ROLE, _roles.admin);
    for (uint256 i = 0; i < _roles.maintainers.length; i++) {
      _setupRole(MAINTAINER_ROLE, _roles.maintainers[i]);
    }
  }

  receive() external payable {}

  // overrides any current implementation with same identifier
  function registerImplementation(
    string calldata identifier,
    address implementation,
    bytes calldata info
  ) external onlyMaintainer() {
    address previous = idToAddress[keccak256(abi.encode(identifier))];
    idToAddress[keccak256(abi.encode(identifier))] = implementation;
    dexImplementationInfo[implementation] = info;
    emit RegisterImplementation(identifier, previous, implementation, info);
  }

  function removeImplementation(string calldata identifier)
    external
    onlyMaintainer()
  {
    bytes32 bytesId = keccak256(abi.encode(identifier));
    require(
      idToAddress[bytesId] != address(0),
      'Implementation with this id does not exist'
    );

    delete dexImplementationInfo[idToAddress[bytesId]];
    delete idToAddress[bytesId];
    emit RemovedImplementation(identifier);
  }

  function getImplementationAddress(string calldata identifier)
    external
    view
    returns (address)
  {
    return idToAddress[keccak256(abi.encode(identifier))];
  }

  function swapAndMint(
    string calldata implementationId,
    SwapMintParams memory inputParams,
    ISynthereumPoolOnChainPriceFeed synthereumPool,
    ISynthereumPoolOnChainPriceFeed.MintParams memory mintParams
  ) external payable override returns (ReturnValues memory returnValues) {
    address implementation =
      idToAddress[keccak256(abi.encode(implementationId))];
    require(implementation != address(0), 'Implementation id not registered');

    string memory functionSig =
      'swapToCollateralAndMint(bytes,(bool,uint256,uint256,bytes),(address,address,(address,uint256,uint256,uint256,uint256,address)))';

    SynthereumMintParams memory synthereumParams =
      SynthereumMintParams(synthereumFinder, synthereumPool, mintParams);

    bytes memory result =
      implementation.functionDelegateCall(
        abi.encodeWithSignature(
          functionSig,
          dexImplementationInfo[implementation],
          inputParams,
          synthereumParams
        )
      );

    returnValues = abi.decode(result, (ReturnValues));

    emit Swap(
      returnValues.inputToken,
      returnValues.outputToken,
      returnValues.collateralToken,
      returnValues.inputAmount,
      returnValues.outputAmount,
      returnValues.collateralAmountRefunded,
      implementation
    );
  }

  function redeemAndSwap(
    string calldata implementationId,
    RedeemSwapParams memory inputParams,
    ISynthereumPoolOnChainPriceFeed synthereumPool,
    ISynthereumPoolOnChainPriceFeed.RedeemParams memory redeemParams,
    address recipient
  ) external override returns (ReturnValues memory returnValues) {
    address implementation =
      idToAddress[keccak256(abi.encode(implementationId))];
    require(implementation != address(0), 'Implementation id not registered');
    string memory functionSig =
      'redeemCollateralAndSwap(bytes,(bool,bool,uint256,uint256,bytes),(address,address,(address,uint256,uint256,uint256,uint256,address)),address)';

    SynthereumRedeemParams memory synthereumParams =
      SynthereumRedeemParams(synthereumFinder, synthereumPool, redeemParams);

    bytes memory result =
      implementation.functionDelegateCall(
        abi.encodeWithSignature(
          functionSig,
          dexImplementationInfo[implementation],
          inputParams,
          synthereumParams,
          recipient
        )
      );

    returnValues = abi.decode(result, (ReturnValues));

    emit Swap(
      returnValues.inputToken,
      returnValues.outputToken,
      returnValues.collateralToken,
      returnValues.inputAmount,
      returnValues.outputAmount,
      returnValues.collateralAmountRefunded,
      implementation
    );
  }
}
