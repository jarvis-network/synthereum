// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;
pragma experimental ABIEncoderV2;

import './IAtomicSwapV2.sol';
import {
  ISynthereumPoolOnChainPriceFeed
} from '@jarvis-network/synthereum-contracts/contracts/synthereum-pool/v4/interfaces/IPoolOnChainPriceFeed.sol';
import {
  ISynthereumFinder
} from '@jarvis-network/synthereum-contracts/contracts/core/interfaces/IFinder.sol';

contract AtomicSwapProxy {
  IAtomicSwapV2 public atomicSwapIface;

  struct ImplementationInfo {
    address routerAddress;
    address synthereumFinder;
    address nativeCryptoAddress; // ie weth address
  }

  // id is sha3(stringID) ie sha3('sushi'), sha3('uniV2') and so on
  // that means only one implementation for each specific dex can exist
  // on UI side, by fixing the identifiers string no fix needs to be done in case on implementations address change
  mapping(bytes32 => address) idToAddress;

  // implementationAddress => ImplementationInfo
  mapping(address => ImplementationInfo) implementationInfo;

  address admin;

  event RegisterImplementation(
    string id,
    address implementation,
    ImplementationInfo info
  );
  event RemovedImplementation(string id);
  event Swap(uint256 outputTokens);

  modifier onlyAdmin() {
    require(msg.sender == admin, 'Only admin');
    _;
  }

  constructor(address _admin) {
    admin = _admin;
  }

  // overrides any current implementation with same identifier
  function registerImplementation(
    string calldata identifier,
    address implementation,
    ImplementationInfo memory info
  ) public onlyAdmin() {
    idToAddress[keccak256(abi.encode(identifier))] = implementation;
    implementationInfo[implementation] = info;
    emit RegisterImplementation(identifier, implementation, info);
  }

  function removeImplementation(string calldata identifier) public onlyAdmin() {
    bytes32 bytesId = keccak256(abi.encode(identifier));
    delete implementationInfo[idToAddress[bytesId]];
    delete idToAddress[bytesId];
    emit RemovedImplementation(identifier);
  }

  // delegate calls to atomic swap implementations
  // will run implementers code in this context (storage, msg.value, msg.sender and so on)
  function swapAndMint(
    string calldata implementationId,
    bool isExactInput,
    uint256 exactAmount,
    uint256 minOutOrMaxIn,
    address[] memory tokenSwapPath,
    bytes memory extraParams,
    ISynthereumPoolOnChainPriceFeed synthereumPool,
    ISynthereumPoolOnChainPriceFeed.MintParams memory mintParams
  ) public payable {
    address implementation =
      idToAddress[keccak256(abi.encode(implementationId))];
    require(implementation != address(0), 'Implementation id not registered');

    string memory functionSig =
      'swapToCollateralAndMint((address,address,address),bool,uint256,uint256,address[],bytes,address,(address,uint256,uint256,uint256,uint256,address))';

    (bool success, bytes memory result) =
      implementation.delegatecall(
        abi.encodeWithSignature(
          functionSig,
          implementationInfo[implementation],
          isExactInput,
          exactAmount,
          minOutOrMaxIn,
          tokenSwapPath,
          extraParams,
          synthereumPool,
          mintParams
        )
      );

    // checks
    require(success, 'Delegate call failed');

    emit Swap(abi.decode(result, (uint256)));
  }

  function redeemCollateralAndSwap(
    string calldata implementationId,
    bool isExactInput,
    uint256 exactAmount,
    uint256 minOutOrMaxIn,
    address[] memory tokenSwapPath,
    bytes memory extraParams,
    ISynthereumPoolOnChainPriceFeed synthereumPool,
    ISynthereumPoolOnChainPriceFeed.RedeemParams memory redeemParams,
    address payable recipient
  ) public {
    address implementation =
      idToAddress[keccak256(abi.encode(implementationId))];
    require(implementation != address(0), 'Implementation id not registered');
    string memory functionSig =
      'redeemCollateralAndSwap((address,address,address),bool,uint256,uint256,address[],bytes,address,(address,uint256,uint256,uint256,uint256,address),address)';

    (bool success, bytes memory result) =
      implementation.delegatecall(
        abi.encodeWithSignature(
          functionSig,
          implementationInfo[implementation],
          isExactInput,
          exactAmount,
          minOutOrMaxIn,
          tokenSwapPath,
          extraParams,
          synthereumPool,
          redeemParams,
          recipient
        )
      );

    // checks
    require(success, 'Delegate call failed');

    emit Swap(abi.decode(result, (uint256)));
  }
}
