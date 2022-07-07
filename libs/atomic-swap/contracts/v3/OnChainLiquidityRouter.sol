// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;
pragma experimental ABIEncoderV2;

import {
  IOnChainLiquidityRouter
} from './interfaces/IOnChainLiquidityRouter.sol';
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
  AccessControlEnumerable,
  Context
} from '@openzeppelin/contracts/access/AccessControlEnumerable.sol';
import {
  ReentrancyGuard
} from '@openzeppelin/contracts/security/ReentrancyGuard.sol';
import {Address} from '@openzeppelin/contracts/utils/Address.sol';

contract OnChainLiquidityRouterV2 is
  IOnChainLiquidityRouter,
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
  string public constant UNWRAP_TO_SIG =
    'unwrapTo(bool,uint256,(address,address,address,address,address,bytes,bytes))';
  string public constant WRAP_FROM_SIG =
    'wrapFrom(bool,address,(address,address,address,address,address,bytes,bytes))';

  ISynthereumFinder public synthereumFinder;

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
    uint256 collateralAmountRefunded
  );
  event SwapAndMint(
    address inputToken,
    address outputToken,
    address collateralToken,
    uint256 inputAmount,
    uint256 outputAmount,
    uint256 collateralAmountRefunded,
    address recipient
  );
  event RedeemAndSwap(
    address inputToken,
    address outputToken,
    address collateralToken,
    uint256 inputAmount,
    uint256 outputAmount,
    uint256 collateralAmountRefunded,
    address recipient
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
    _setupRole(MAINTAINER_ROLE, _roles.maintainer);
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

    emit SwapAndMint(
      returnValues.inputToken,
      returnValues.outputToken,
      returnValues.collateralToken,
      returnValues.inputAmount,
      returnValues.outputAmount,
      returnValues.collateralAmountRefunded,
      mintParams.recipient
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

    emit RedeemAndSwap(
      returnValues.inputToken,
      returnValues.outputToken,
      returnValues.collateralToken,
      returnValues.inputAmount,
      returnValues.outputAmount,
      returnValues.collateralAmountRefunded,
      recipient
    );
  }

  function wrapFixedRateFrom(
    bool fromERC20,
    string memory implementationId,
    address inputAsset,
    address outputAsset,
    bytes calldata operationArgs,
    address recipient
  ) external override returns (ReturnValues memory returnValues) {
    address fixedRateSwap = idToAddress[keccak256(abi.encode('fixedRateSwap'))];
    address implementation =
      idToAddress[keccak256(abi.encode(implementationId))];
    require(implementation != address(0), 'Implementation id not registered');

    FixedRateSwapParams memory params =
      FixedRateSwapParams(
        _msgSender(),
        implementation,
        inputAsset,
        outputAsset,
        address(synthereumFinder),
        dexImplementationInfo[implementation],
        operationArgs
      );

    bytes memory result =
      fixedRateSwap.functionDelegateCall(
        abi.encodeWithSignature(WRAP_FROM_SIG, fromERC20, recipient, params)
      );

    returnValues = abi.decode(result, (ReturnValues));

    emit Swap(
      returnValues.inputToken,
      returnValues.outputToken,
      returnValues.collateralToken,
      returnValues.inputAmount,
      returnValues.outputAmount,
      returnValues.collateralAmountRefunded
    );
  }

  function unwrapFixedRateTo(
    bool toERC20,
    string memory implementationId,
    address inputAsset,
    address outputAsset,
    uint256 inputAmount,
    bytes calldata operationArgs
  ) external override returns (ReturnValues memory returnValues) {
    address fixedRateSwap = idToAddress[keccak256(abi.encode('fixedRateSwap'))];
    address implementation =
      idToAddress[keccak256(abi.encode(implementationId))];
    require(implementation != address(0), 'Implementation id not registered');

    FixedRateSwapParams memory params =
      FixedRateSwapParams(
        _msgSender(),
        implementation,
        inputAsset,
        outputAsset,
        address(synthereumFinder),
        dexImplementationInfo[implementation],
        operationArgs
      );

    bytes memory result =
      fixedRateSwap.functionDelegateCall(
        abi.encodeWithSignature(UNWRAP_TO_SIG, toERC20, inputAmount, params)
      );

    returnValues = abi.decode(result, (ReturnValues));

    emit Swap(
      returnValues.inputToken,
      returnValues.outputToken,
      returnValues.collateralToken,
      returnValues.inputAmount,
      returnValues.outputAmount,
      returnValues.collateralAmountRefunded
    );
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

  /**
   * @notice Check if an address is the trusted forwarder
   * @param  forwarder Address to check
   * @return True is the input address is the trusted forwarder, otherwise false
   */
  function isTrustedForwarder(address forwarder)
    public
    view
    override
    returns (bool)
  {
    try
      synthereumFinder.getImplementationAddress(
        SynthereumInterfaces.TrustedForwarder
      )
    returns (address trustedForwarder) {
      if (forwarder == trustedForwarder) {
        return true;
      } else {
        return false;
      }
    } catch {
      return false;
    }
  }

  function _msgSender()
    internal
    view
    override(ERC2771Context, Context)
    returns (address sender)
  {
    return ERC2771Context._msgSender();
  }

  function _msgData()
    internal
    view
    override(ERC2771Context, Context)
    returns (bytes calldata)
  {
    return ERC2771Context._msgData();
  }
}
