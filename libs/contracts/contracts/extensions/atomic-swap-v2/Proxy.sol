// SPDX-License-Identifier: MIT

pragma solidity >=0.7.5;
pragma experimental ABIEncoderV2;

import './IAtomicSwapV2.sol';
import {
  ISynthereumPoolOnChainPriceFeed
} from '../../synthereum-pool/v4/interfaces/IPoolOnChainPriceFeed.sol';

contract AtomicSwapProxy {
  IAtomicSwapV2 public atomicSwapIface;

  // id is sha3(stringID) ie sha3('sushi'), sha3('uniV2') and so on
  // that means only one implementation for each specific dex can exist
  // on UI side, by fixing the identifiers string no fix needs to be done in case on implementations address change
  mapping(bytes32 => address) idToAddress;

  address admin;

  event RegisterImplementation(string id, address implementation);
  event RemovedImplementation(string id);
  event Swap(uint256 outputTokens);

  modifier onlyAdmin() {
    require(msg.sender == admin, 'Only admin');
    _;
  }

  modifier isRegisteredImplementation(string implementationId) {
    address implementation =
      idToAddress[keccak256(abi.encode(implementationId))];
    require(implementation != address(0), 'Implementation id not registered');
    _;
  }

  constructor(address _admin) public {
    admin = _admin;
  }

  // overrides any current implementation with same identifier
  function registerImplementation(
    string calldata identifier,
    address implementation
  ) public onlyAdmin() {
    // TODO an interface check to avoid errors
    idToAddress[keccak256(abi.encode(identifier))] = implementation;
    emit RegisterImplementation(identifier, implementation);
  }

  function removeImplementation(string calldata identifier) public onlyAdmin() {
    delete idToAddress[keccak256(abi.encode(identifier))];
    emit RemovedImplementation(identifier);
  }

  // delegate calls to atomic swap implementations
  // will run implementers code in this context (storage, msg.value, msg.sender and so on)
  function swapAndMint(
    string calldata implementationId,
    bool isExactInput,
    uint256 amountSpecified,
    uint256 minOutOrMaxIn,
    address[] memory tokenSwapPath,
    address[] memory poolsPath,
    ISynthereumPoolOnChainPriceFeed synthereumPool,
    ISynthereumPoolOnChainPriceFeed.MintParams memory mintParams
  ) public isRegisteredImplementation(implementationId) {
    string memory functionSig =
      'swapToCollateralAndMint(bool,uint256,uint256,address[],address[],address,(address,uint256,uint256,uint256,uint256,address))';

    (bool success, bytes memory result) =
      implementation.delegatecall(
        abi.encodeWithSignature(
          functionSig,
          isExactInput,
          amountSpecified,
          minOutOrMaxIn,
          tokenSwapPath,
          poolsPath,
          synthereumPool,
          mintParams,
          recipient
        )
      );

    // checks
    require(success, 'Delegate call failed');

    emit Swap(abi.decode(result, (uint256)));
  }

  function redeemCollateralAndSwap(
    string calldata implementationId,
    bool isExactInput,
    uint256 amountSpecified,
    uint256 minOutOrMaxIn,
    address[] memory tokenSwapPath,
    address[] memory poolsPath,
    ISynthereumPoolOnChainPriceFeed synthereumPool,
    ISynthereumPoolOnChainPriceFeed.RedeemParams memory redeemParams,
    address payable recipient
  ) public isRegisteredImplementation(implementationId) {
    string memory functionSig =
      'redeemCollateralAndSwap(bool,uint256,uint256,address[],address[],address,(address,uint256,uint256,uint256,uint256,address),address)';

    (bool success, bytes memory result) =
      implementation.delegatecall(
        abi.encodeWithSignature(
          functionSig,
          isExactInput,
          amountSpecified,
          minOutOrMaxIn,
          tokenSwapPath,
          poolsPath,
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
