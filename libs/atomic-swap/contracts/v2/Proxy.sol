// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;
pragma experimental ABIEncoderV2;

import './interfaces/IAtomicSwapV2.sol';
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

  IAtomicSwapV2 public atomicSwapIface;

  // id is sha3(stringID) ie sha3('sushi'), sha3('uniV2') and so on
  // that means only one implementation for each specific dex can exist
  // on UI side, by fixing the identifiers string no fix needs to be done in case on implementations address change
  mapping(bytes32 => address) public idToAddress;

  mapping(address => bytes) public dexImplementationInfo;

  bytes32 public constant MAINTAINER_ROLE = keccak256('Maintainer');

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
    uint256 inputAmount,
    uint256 outputAmount,
    address dexImplementationAddress
  );
  modifier onlyMaintainer() {
    require(
      hasRole(MAINTAINER_ROLE, msg.sender),
      'Only contract maintainer can call this function'
    );
    _;
  }

  constructor(Roles memory _roles) {
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
    bytes memory info
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

  // delegate calls to atomic swap implementations
  // will run implementers code in this context (storage, msg.value, msg.sender and so on)
  /// @return amounts = [inputAmount, outputAmount]
  function swapAndMint(
    string calldata implementationId,
    bool isExactInput,
    uint256 exactAmount,
    uint256 minOutOrMaxIn,
    bytes memory extraParams,
    ISynthereumPoolOnChainPriceFeed synthereumPool,
    ISynthereumPoolOnChainPriceFeed.MintParams memory mintParams
  ) external payable override returns (uint256[2] memory amounts) {
    address implementation =
      idToAddress[keccak256(abi.encode(implementationId))];
    require(implementation != address(0), 'Implementation id not registered');

    string memory functionSig =
      'swapToCollateralAndMint(bytes,bool,uint256,uint256,bytes,address,(address,uint256,uint256,uint256,uint256,address))';

    bytes memory result =
      implementation.functionDelegateCall(
        abi.encodeWithSignature(
          functionSig,
          dexImplementationInfo[implementation],
          isExactInput,
          exactAmount,
          minOutOrMaxIn,
          extraParams,
          synthereumPool,
          mintParams
        )
      );

    ReturnValues memory returnValues = abi.decode(result, (ReturnValues));
    amounts[0] = returnValues.inputAmount;
    amounts[1] = returnValues.outputAmount;

    emit Swap(
      returnValues.inputToken,
      returnValues.outputToken,
      returnValues.inputAmount,
      returnValues.outputAmount,
      implementation
    );
  }

  function redeemCollateralAndSwap(
    string calldata implementationId,
    RedeemSwapParams memory inputParams,
    ISynthereumPoolOnChainPriceFeed synthereumPool,
    ISynthereumPoolOnChainPriceFeed.RedeemParams memory redeemParams,
    address recipient
  ) external override returns (uint256[2] memory amounts) {
    address implementation =
      idToAddress[keccak256(abi.encode(implementationId))];
    require(implementation != address(0), 'Implementation id not registered');
    string memory functionSig =
      'redeemCollateralAndSwap(bytes,(bool,bool,uint256,uint256,bytes),address,(address,uint256,uint256,uint256,uint256,address),address)';

    bytes memory result =
      implementation.functionDelegateCall(
        abi.encodeWithSignature(
          functionSig,
          dexImplementationInfo[implementation],
          inputParams,
          synthereumPool,
          redeemParams,
          recipient
        )
      );

    ReturnValues memory returnValues = abi.decode(result, (ReturnValues));
    amounts[0] = returnValues.inputAmount;
    amounts[1] = returnValues.outputAmount;

    emit Swap(
      returnValues.inputToken,
      returnValues.outputToken,
      returnValues.inputAmount,
      returnValues.outputAmount,
      implementation
    );
  }
}
