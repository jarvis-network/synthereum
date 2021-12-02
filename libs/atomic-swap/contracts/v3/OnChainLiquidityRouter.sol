// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;
pragma experimental ABIEncoderV2;

import {
  ISynthereumLiquidityPool
} from '@jarvis-network/synthereum-contracts/contracts/synthereum-pool/v5/interfaces/ILiquidityPool.sol';
import {
  SynthereumInterfaces
} from '@jarvis-network/synthereum-contracts/contracts/core/Constants.sol';
import {
  ISynthereumFinder
} from '@jarvis-network/synthereum-contracts/contracts/core/interfaces/IFinder.sol';
import {
  ERC2771Context
} from '@jarvis-network/synthereum-contracts/contracts/common/ERC2771Context.sol';
import {
  IOnChainLiquidityRouterV2
} from './interfaces/IOnChainLiquidityRouter.sol';
import {
  AccessControlEnumerable,
  Context
} from '@openzeppelin/contracts/access/AccessControlEnumerable.sol';
import {
  ReentrancyGuard
} from '@openzeppelin/contracts/security/ReentrancyGuard.sol';
import {Address} from '@openzeppelin/contracts/utils/Address.sol';

contract OnChainLiquidityRouterV2 is
  IOnChainLiquidityRouterV2,
  AccessControlEnumerable,
  ERC2771Context,
  ReentrancyGuard
{
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

  /// @notice Stores information abount an OCLR implementation under an id
  /// @param identifier: string identifier of the OCLR implementation. Registering an existing id will result in an overwrite.
  /// @param implementation: address of the OCLR implementation smart contract.
  /// @param info: bytes encoded info useful when calling the OCLR implementation.
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

  /// @notice Removes information abount an OCLR implementation under an id
  /// @param identifier: string identifier of the OCLR implementation.
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

  /// @notice Gets the OCLR implementation address stored under an id
  /// @param identifier: string identifier of the OCLR implementation.
  /// @return address of the implementation
  function getImplementationAddress(string calldata identifier)
    external
    view
    returns (address)
  {
    return idToAddress[keccak256(abi.encode(identifier))];
  }

  // see IOnChainLiquidityRouter.sol
  function swapAndMint(
    string calldata implementationId,
    SwapMintParams memory inputParams,
    ISynthereumLiquidityPool synthereumPool,
    ISynthereumLiquidityPool.MintParams memory mintParams
  )
    external
    payable
    override
    nonReentrant()
    returns (ReturnValues memory returnValues)
  {
    address implementation =
      idToAddress[keccak256(abi.encode(implementationId))];
    require(implementation != address(0), 'Implementation id not registered');

    string memory functionSig =
      'swapToCollateralAndMint(bytes,(bool,uint256,uint256,bytes,address),(address,address,(uint256,uint256,uint256,address)))';
    SynthereumMintParams memory synthereumParams =
      SynthereumMintParams(synthereumFinder, synthereumPool, mintParams);

    // store msg sender using ERC2771Context
    inputParams.msgSender = _msgSender();

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

  // see IOnChainLiquidityRouter.sol
  function redeemAndSwap(
    string calldata implementationId,
    RedeemSwapParams memory inputParams,
    ISynthereumLiquidityPool synthereumPool,
    ISynthereumLiquidityPool.RedeemParams memory redeemParams,
    address recipient
  )
    external
    override
    nonReentrant()
    returns (ReturnValues memory returnValues)
  {
    address implementation =
      idToAddress[keccak256(abi.encode(implementationId))];
    require(implementation != address(0), 'Implementation id not registered');

    string memory functionSig =
      'redeemCollateralAndSwap(bytes,(bool,bool,uint256,uint256,bytes,address),(address,address,(uint256,uint256,uint256,address)),address)';
    SynthereumRedeemParams memory synthereumParams =
      SynthereumRedeemParams(synthereumFinder, synthereumPool, redeemParams);

    // store msg sender using ERC2771Context
    inputParams.msgSender = _msgSender();

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

  /**
   * @notice Check if an address is the trusted forwarder
   * @param  forwarder Address to check
   * @return True is the input address is the trusted forwarder, otherwise false
   */
  function isTrustedForwarder(address forwarder)
    public
    view
    override(ERC2771Context)
    returns (bool)
  {
    return
      forwarder ==
      synthereumFinder.getImplementationAddress(
        SynthereumInterfaces.TrustedForwarder
      );
  }

  function _msgSender()
    internal
    view
    override(ERC2771Context, Context)
    returns (address sender)
  {
    if (isTrustedForwarder(msg.sender)) {
      // The assembly code is more direct than the Solidity version using `abi.decode`.
      assembly {
        sender := shr(96, calldataload(sub(calldatasize(), 20)))
      }
    } else {
      return ERC2771Context._msgSender();
    }
  }

  function _msgData()
    internal
    view
    override(ERC2771Context, Context)
    returns (bytes calldata)
  {
    if (isTrustedForwarder(msg.sender)) {
      return msg.data[0:msg.data.length - 20];
    } else {
      return ERC2771Context._msgData();
    }
  }
}
