// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity 0.8.9;

import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {IMintableBurnableERC20} from '../tokens/interfaces/IMintableBurnableERC20.sol';
import {ISynthereumFinder} from '../core/interfaces/IFinder.sol';
import {ISynthereumCCIPBridge} from './interfaces/ICCIPBridge.sol';
import {SynthereumInterfaces} from '../core/Constants.sol';
import {Address} from '@openzeppelin/contracts/utils/Address.sol';
import {SafeERC20} from '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import {SafeCast} from '@openzeppelin/contracts/utils/math/SafeCast.sol';
import {Context} from '@openzeppelin/contracts/utils/Context.sol';
import {ERC2771Context} from '../common/ERC2771Context.sol';
import {ReentrancyGuard} from '@openzeppelin/contracts/security/ReentrancyGuard.sol';
import {Client} from '@chainlink/contracts-ccip/src/v0.8/ccip/libraries/Client.sol';
import {CCIPReceiver} from './CCIPReceiver.sol';
import {AccessControlEnumerable} from '@openzeppelin/contracts/access/AccessControlEnumerable.sol';
import {StandardAccessControlEnumerable} from '../common/roles/StandardAccessControlEnumerable.sol';

/**
 * @title Synthereum CCIP bridge for moving synthetic assets cross-chain
 */
contract SynthereumCCIPBridge is
  ISynthereumCCIPBridge,
  ERC2771Context,
  ReentrancyGuard,
  StandardAccessControlEnumerable,
  CCIPReceiver
{
  using Address for address payable;
  using SafeERC20 for IERC20;
  using SafeERC20 for IMintableBurnableERC20;
  using SafeCast for uint256;

  struct MessageEndpoints {
    address contractSender;
    address contractReceiver;
  }

  struct TransferTokensCache {
    address messageReceiver;
    int256 actualBridgedAmount;
    int256 amount;
    address msgSender;
  }

  //----------------------------------------
  // Storage
  //----------------------------------------
  ISynthereumFinder public immutable synthereumFinder;

  mapping(uint64 => MessageEndpoints) internal endpoints;

  mapping(uint64 => Client.EVMExtraArgsV1) internal extraArgs;

  mapping(IMintableBurnableERC20 => mapping(uint64 => IMintableBurnableERC20))
    internal tokensMap;

  mapping(uint64 => bool) freeFee;

  mapping(IMintableBurnableERC20 => mapping(uint64 => int256)) chainBridgedAmount;

  mapping(IMintableBurnableERC20 => int256) totalBridgedAmount;

  mapping(IMintableBurnableERC20 => mapping(uint64 => uint256)) chainMaxAmount;

  //----------------------------------------
  // Events
  //----------------------------------------
  event EndpointsSet(
    uint64 indexed chainSelector,
    address messageSender,
    address messageReceiver
  );

  event EndpointsRemoved(uint64 indexed chainSelector);

  event ExtraArgsSet(
    uint64 indexed chainSelector,
    uint256 gasLimit,
    bool strict
  );

  event ExtraArgsRemoved(uint64 indexed chainSelector);

  event TokenMapped(
    IMintableBurnableERC20 indexed sourceToken,
    uint64 indexed chainSelector,
    IMintableBurnableERC20 indexed destinationToken
  );

  event TokenUnmapped(
    IMintableBurnableERC20 indexed sourceToken,
    uint64 indexed chainSelector
  );

  event MaxChainAmountSet(
    IMintableBurnableERC20 indexed sourceToken,
    uint64 indexed chainSelector,
    uint256 maxAmount
  );

  event MaxChainAmountRemoved(
    IMintableBurnableERC20 indexed sourceToken,
    uint64 indexed chainSelector
  );

  event FreeFeeSet(uint64 indexed chainSelector, bool indexed isFree);

  // Event emitted when the tokens are burned on the source chain and the message sent to ccipi
  event TransferInitiated(
    bytes32 indexed messageId,
    uint64 indexed destinationChainSelector,
    address destinationEndpoint,
    IMintableBurnableERC20 sourceToken,
    IMintableBurnableERC20 destinationToken,
    uint256 amount,
    address sender,
    address receiver,
    address feeToken,
    uint256 fees
  );

  // Event emitted when message is received from ccip and the tokens are minted on the destination chain
  event TransferCompleted(
    bytes32 indexed messageId,
    uint64 indexed sourceChainSelector,
    address sourceEndpoint,
    IMintableBurnableERC20 sourceToken,
    IMintableBurnableERC20 destinationToken,
    uint256 amount,
    address receiver
  );

  //----------------------------------------
  // Constructor
  //----------------------------------------
  /**
   * @notice Constructs the SynthereumCCIPBridge contract
   * @param _synthereumFinder Synthereum finder contract
   * @param _router Chainlink CCIP router
   * @param _roles Admin and Mainteiner roles
   */
  constructor(
    ISynthereumFinder _synthereumFinder,
    address _router,
    Roles memory _roles
  ) CCIPReceiver(_router) {
    synthereumFinder = _synthereumFinder;
    _setAdmin(_roles.admin);
    _setMaintainer(_roles.maintainer);
  }

  receive() external payable {}

  //----------------------------------------
  // External functions
  //----------------------------------------

  /**
   * @notice Set new router
   * @notice Only maintainer can call this function
   * @param _router Address of the new router
   */
  function setRouter(address _router) external onlyMaintainer {
    _setRouter(_router);
  }

  /**
   * @notice Set sender and receiver endpoint for a chain
   * @notice Only maintainer can call this function
   * @param _chainSelector CCIP chain selector of the destination chain
   * @param _msgSenderEndpoint Sender endpoint for the destination chain in input
   * @param _msgReceiverEndpoint Receiver endpoint for the destination chain in input
   */
  function setEndpoints(
    uint64 _chainSelector,
    address _msgSenderEndpoint,
    address _msgReceiverEndpoint
  ) external onlyMaintainer {
    require(i_router.isChainSupported(_chainSelector), 'Chain not supported');
    require(
      _msgSenderEndpoint != address(0) && _msgReceiverEndpoint != address(0),
      'Null input endpoint'
    );
    endpoints[_chainSelector] = MessageEndpoints(
      _msgSenderEndpoint,
      _msgReceiverEndpoint
    );
    emit EndpointsSet(_chainSelector, _msgSenderEndpoint, _msgReceiverEndpoint);
  }

  /**
   * @notice Remove sender and receiver endpoint for a chain
   * @notice Only maintainer can call this function
   * @param _chainSelector CCIP chain selector of the destination chain
   */
  function removeEndpoints(uint64 _chainSelector) external onlyMaintainer {
    require(
      endpoints[_chainSelector].contractSender != address(0) &&
        endpoints[_chainSelector].contractReceiver != address(0),
      'Endpoints not supported'
    );
    delete endpoints[_chainSelector];
    emit EndpointsRemoved(_chainSelector);
  }

  /**
   * @notice Set extra args for a chain
   * @notice Only maintainer can call this function
   * @param _chainSelector CCIP chain selector
   * @param _gasLimit CCIP gas limit for executing transaction by CCIP protocol on on the destination chain in input
   * @param _strict CCIP flag for stop the execution of the queue on the input chain in case of error
   */
  function setExtraArgs(
    uint64 _chainSelector,
    uint256 _gasLimit,
    bool _strict
  ) external onlyMaintainer {
    require(i_router.isChainSupported(_chainSelector), 'Chain not supported');
    require(_gasLimit != 0, 'Null gas input');
    extraArgs[_chainSelector] = Client.EVMExtraArgsV1(_gasLimit, _strict);
    emit ExtraArgsSet(_chainSelector, _gasLimit, _strict);
  }

  /**
   * @notice Remove extra args for a chain
   * @notice Only maintainer can call this function
   * @param _chainSelector CCIP chain selector of the destination chain
   */
  function removeExtraArgs(uint64 _chainSelector) external onlyMaintainer {
    require(extraArgs[_chainSelector].gasLimit != 0, 'Args not supported');
    delete extraArgs[_chainSelector];
    emit ExtraArgsRemoved(_chainSelector);
  }

  /**
   * @notice Map tokens between this chain and a destination chain
   * @param _chainSelector CCIP chain selector of the destination chain
   * @param _srcTokens List of tokens on this chain
   * @param _destTokens List of tokens on the destination chain in input
   */
  function setMappedTokens(
    uint64 _chainSelector,
    IMintableBurnableERC20[] calldata _srcTokens,
    IMintableBurnableERC20[] calldata _destTokens
  ) external onlyMaintainer {
    require(i_router.isChainSupported(_chainSelector), 'Chain not supported');
    uint256 tokensNumber = _srcTokens.length;
    require(tokensNumber > 0, 'No tokens passed');
    require(
      tokensNumber == _destTokens.length,
      'Src and dest tokens do not match'
    );
    for (uint256 j = 0; j < tokensNumber; ) {
      require(
        address(_srcTokens[j]) != address(0) &&
          address(_destTokens[j]) != address(0),
        'Null token'
      );
      tokensMap[_srcTokens[j]][_chainSelector] = _destTokens[j];
      emit TokenMapped(_srcTokens[j], _chainSelector, _destTokens[j]);
      unchecked {
        j++;
      }
    }
  }

  /**
   * @notice Remove mapped tokens between this chain and a destination chain
   * @notice Only maintainer can call this function
   * @param _chainSelector CCIP chain selector of the destination chain
   * @param _srcTokens List of tokens on this chain to be removed
   */
  function removeMappedTokens(
    uint64 _chainSelector,
    IMintableBurnableERC20[] calldata _srcTokens
  ) external onlyMaintainer {
    uint256 tokensNumber = _srcTokens.length;
    require(tokensNumber > 0, 'No tokens passed');
    for (uint256 j = 0; j < tokensNumber; ) {
      require(
        address(tokensMap[_srcTokens[j]][_chainSelector]) != address(0),
        'Token not supported'
      );
      delete tokensMap[_srcTokens[j]][_chainSelector];
      emit TokenUnmapped(_srcTokens[j], _chainSelector);
      unchecked {
        j++;
      }
    }
  }

  /**
   * @notice Set max amount of a token that can be bridged on a destination chain
   * @param _chainSelector CCIP chain selector of the destination chain
   * @param _srcTokens List of tokens on this chain
   * @param _amounts List of the max amounts
   */
  function setMaxChainAmount(
    uint64 _chainSelector,
    IMintableBurnableERC20[] calldata _srcTokens,
    uint256[] calldata _amounts
  ) external onlyMaintainer {
    require(i_router.isChainSupported(_chainSelector), 'Chain not supported');
    uint256 tokensNumber = _srcTokens.length;
    require(tokensNumber > 0, 'No tokens passed');
    require(
      tokensNumber == _amounts.length,
      'Src tokens and amounts do not match'
    );
    for (uint256 j = 0; j < tokensNumber; ) {
      require(address(_srcTokens[j]) != address(0), 'Null token');
      require(_amounts[j] > 0, 'Null amount');
      chainMaxAmount[_srcTokens[j]][_chainSelector] = _amounts[j];
      emit MaxChainAmountSet(_srcTokens[j], _chainSelector, _amounts[j]);
      unchecked {
        j++;
      }
    }
  }

  /**
   * @notice Remove  max amount of a token that can be bridged on a destination chain
   * @notice Only maintainer can call this function
   * @param _chainSelector CCIP chain selector of the destination chain
   * @param _srcTokens List of tokens on this chain whose max amount are removed
   */
  function removeMaxChainAmount(
    uint64 _chainSelector,
    IMintableBurnableERC20[] calldata _srcTokens
  ) external onlyMaintainer {
    uint256 tokensNumber = _srcTokens.length;
    require(tokensNumber > 0, 'No tokens passed');
    for (uint256 j = 0; j < tokensNumber; ) {
      require(
        chainMaxAmount[_srcTokens[j]][_chainSelector] != 0,
        'Max amount not set'
      );
      delete chainMaxAmount[_srcTokens[j]][_chainSelector];
      emit MaxChainAmountRemoved(_srcTokens[j], _chainSelector);
      unchecked {
        j++;
      }
    }
  }

  /**
   * @notice Set fee to free or not
   * @notice Only maintainer can call this function
   * @param _chainSelector CCIP chain selector of the destination chain
   * @param _isFree True if free, otherwise false
   */
  function setFreeFee(uint64 _chainSelector, bool _isFree)
    external
    onlyMaintainer
  {
    require(freeFee[_chainSelector] != _isFree, 'Free fee already set');
    freeFee[_chainSelector] = _isFree;
    emit FreeFeeSet(_chainSelector, _isFree);
  }

  /**
   * @notice Burn tokens on this chain and trigger CCIP bridge for receiving on the destination chain
   * @param _destinationChainSelector CCIP chain selector of the destination chain
   * @param _token Address of the synth token to bridge
   * @param _amount Amount to bridge
   * @param _recipient Address to which receive synth tokens on the destination chain
   * @param _feeToken Address of the token used to pay fees for bridging
   * @return messageId CCIP output message id
   * @return fees Amount of fees to be paid
   */
  function transferTokensToDestinationChain(
    uint64 _destinationChainSelector,
    address _token,
    uint256 _amount,
    address _recipient,
    address _feeToken
  ) external payable nonReentrant returns (bytes32 messageId, uint256 fees) {
    TransferTokensCache memory cache;
    cache.messageReceiver = getDestEndpoint(_destinationChainSelector);
    IMintableBurnableERC20 destToken = IMintableBurnableERC20(
      getMappedToken(_token, _destinationChainSelector)
    );

    cache.actualBridgedAmount = chainBridgedAmount[
      IMintableBurnableERC20(_token)
    ][_destinationChainSelector];
    cache.amount = _amount.toInt256();
    require(
      cache.amount - cache.actualBridgedAmount <=
        chainMaxAmount[IMintableBurnableERC20(_token)][
          _destinationChainSelector
        ].toInt256(),
      'Max bridged amount reached'
    );

    cache.msgSender = _msgSender();
    (messageId, fees) = _burnAndSendCCIPMessage(
      _destinationChainSelector,
      cache.messageReceiver,
      IMintableBurnableERC20(_token),
      destToken,
      _amount,
      cache.msgSender,
      _recipient,
      _feeToken
    );

    chainBridgedAmount[IMintableBurnableERC20(_token)][
      _destinationChainSelector
    ] = cache.actualBridgedAmount - cache.amount;
    totalBridgedAmount[IMintableBurnableERC20(_token)] -= cache.amount;

    // Emit an event with message details
    emit TransferInitiated(
      messageId,
      _destinationChainSelector,
      cache.messageReceiver,
      IMintableBurnableERC20(_token),
      destToken,
      _amount,
      cache.msgSender,
      _recipient,
      _feeToken,
      fees
    );
  }

  /**
   * @notice Withdraw deposited native tokens
   * @notice Only maintainer can call this function
   * @param _beneficiary Address used for receiving native tokens
   */
  function withdraw(address payable _beneficiary)
    external
    onlyMaintainer
    nonReentrant
  {
    // Retrieve the balance of this contract
    uint256 amount = address(this).balance;

    // Revert if there is nothing to withdraw
    require(amount > 0, 'Nothing to withdraw');

    // Attempt to send the funds, capturing the success status and discarding any return data
    _beneficiary.sendValue(amount);
  }

  /**
   * @notice Withdraw deposited ERC20 tokens
   * @notice Only maintainer can call this function
   * @param _token Address of the token to withdraw
   * @param _beneficiary Address used for receiving ERC20 tokens
   */
  function withdrawToken(address _token, address _beneficiary)
    external
    onlyMaintainer
    nonReentrant
  {
    // Retrieve the balance of this contract
    uint256 amount = IERC20(_token).balanceOf(address(this));

    // Revert if there is nothing to withdraw
    require(amount > 0, 'Nothing to withdraw');

    IERC20(_token).safeTransfer(_beneficiary, amount);
  }

  /**
   * @notice Check if a token is whitelisted for a destination chain
   * @param _token Address of the token on this chain
   * @param _chainSelector CCIP chain selector of the destination chain
   * @return True if token is whitelisted, otherwise false
   */
  function isTokenWhitelisted(address _token, uint64 _chainSelector)
    external
    view
    returns (bool)
  {
    return
      address(tokensMap[IMintableBurnableERC20(_token)][_chainSelector]) !=
      address(0);
  }

  /**
   * @notice Check if endpoints are supported for a destination chain
   * @param _chainSelector CCIP chain selector of the destination chain
   * @return True if endpoints are supported, otherwise false
   */
  function isEndpointSupported(uint64 _chainSelector)
    external
    view
    returns (bool)
  {
    return
      endpoints[_chainSelector].contractSender != address(0) &&
      endpoints[_chainSelector].contractReceiver != address(0);
  }

  /**
   * @notice Check if extra args are supported for a destination chain
   * @param _chainSelector CCIP chain selector of the destination chain
   * @return True if extra args are supported, otherwise false
   */
  function isExtraArgsSupported(uint64 _chainSelector)
    external
    view
    returns (bool)
  {
    return extraArgs[_chainSelector].gasLimit != 0;
  }

  /**
   * @notice Check if the fee is free on the input destination chain
   * @param _chainSelector CCIP chain selector of the destination chain
   * @return True if fee is flat, otherwise false
   */
  function isFeeFree(uint64 _chainSelector) external view returns (bool) {
    return freeFee[_chainSelector];
  }

  /**
   * @notice Amount of bridged token (negative outbound bridge, positive inbound bridge) for every chain
   * @param _token Address of the token
   * @return Total bridged amount
   */
  function getTotalBridgedAmount(address _token)
    external
    view
    returns (int256)
  {
    return totalBridgedAmount[IMintableBurnableERC20(_token)];
  }

  /**
   * @notice Amount of bridged token (negative outbound bridge, positive inbound bridge) for the input chain
   * @param _token Address of the token
   * @param _destChainSelector CCIP chain selector of the destination chain
   * @return Bridged amount for the input chain
   */
  function getChainBridgedAmount(address _token, uint64 _destChainSelector)
    external
    view
    returns (int256)
  {
    return
      chainBridgedAmount[IMintableBurnableERC20(_token)][_destChainSelector];
  }

  /**
   * @notice Max amount of token to be bridged on input destination chain
   * @param _token Address of the token
   * @param _destChainSelector CCIP chain selector of the destination chain
   * @return Max amount to be bridged
   */
  function getMaxChainAmount(address _token, uint64 _destChainSelector)
    external
    view
    returns (uint256)
  {
    return chainMaxAmount[IMintableBurnableERC20(_token)][_destChainSelector];
  }

  /**
   * @notice Get the source endpoint for the input chain
   * @param _chainSelector CCIP chain selector of the source chain
   * @return srcEndpoint Source endpoint
   */
  function getSrcEndpoint(uint64 _chainSelector)
    public
    view
    returns (address srcEndpoint)
  {
    srcEndpoint = endpoints[_chainSelector].contractSender;
    require(srcEndpoint != address(0), 'Src endpoint not supported');
  }

  /**
   * @notice Get the destination endpoint for the input chain
   * @param _chainSelector CCIP chain selector of the destination chain
   * @return destEndpoint Destination endpoint
   */
  function getDestEndpoint(uint64 _chainSelector)
    public
    view
    returns (address destEndpoint)
  {
    destEndpoint = endpoints[_chainSelector].contractReceiver;
    require(destEndpoint != address(0), 'Dest endpoint not supported');
  }

  /**
   * @notice Get the extra-args for the input destination chain
   * @param _chainSelector CCIP chain selector of the destination chain
   * @return args GasLimit and strict
   */
  function getExtraArgs(uint64 _chainSelector)
    public
    view
    returns (Client.EVMExtraArgsV1 memory args)
  {
    args = extraArgs[_chainSelector];
    require(args.gasLimit != 0, 'Args not supported');
  }

  /**
   * @notice Get the address of the mapped token with the input token on the input destination chain
   * @param _srcToken Address of the token
   * @param _chainSelector CCIP chain selector of the destination chain
   * @return destToken Address of mapped token on the destination chain
   */
  function getMappedToken(address _srcToken, uint64 _chainSelector)
    public
    view
    returns (address destToken)
  {
    destToken = address(
      tokensMap[IMintableBurnableERC20(_srcToken)][_chainSelector]
    );
    require(address(destToken) != address(0), 'Token not supported');
  }

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

  /// @notice IERC165 supports an interfaceId
  /// @param interfaceId The interfaceId to check
  /// @return true if the interfaceId is supported
  function supportsInterface(bytes4 interfaceId)
    public
    pure
    override(CCIPReceiver, AccessControlEnumerable)
    returns (bool)
  {
    return CCIPReceiver.supportsInterface(interfaceId);
  }

  // called by the router for mint tokens on the destination chain
  function _ccipReceive(Client.Any2EVMMessage memory message)
    internal
    override
    nonReentrant
  {
    // decode cross chain message
    (
      IMintableBurnableERC20 srcToken,
      IMintableBurnableERC20 destToken,
      uint256 amount,
      address recipient
    ) = abi.decode(
      message.data,
      (IMintableBurnableERC20, IMintableBurnableERC20, uint256, address)
    );

    address srcEndpoint = getSrcEndpoint(message.sourceChainSelector);

    require(
      abi.decode(message.sender, (address)) == srcEndpoint,
      'Wrong src endpoint'
    );
    require(
      address(srcToken) ==
        address(
          getMappedToken(address(destToken), message.sourceChainSelector)
        ),
      'Wrong src token'
    );

    // mint token to recipient
    IMintableBurnableERC20(destToken).mint(recipient, amount);

    chainBridgedAmount[destToken][message.sourceChainSelector] += amount
      .toInt256();
    totalBridgedAmount[destToken] += amount.toInt256();

    emit TransferCompleted(
      message.messageId,
      message.sourceChainSelector,
      srcEndpoint,
      srcToken,
      destToken,
      amount,
      recipient
    );
  }

  // burn tokens and trigger bridge message on CCIP
  function _burnAndSendCCIPMessage(
    uint64 _destinationChainSelector,
    address _messageReceiver,
    IMintableBurnableERC20 _srcToken,
    IMintableBurnableERC20 _destToken,
    uint256 _amount,
    address _tokenSender,
    address _tokenRecipient,
    address _feeToken
  ) internal returns (bytes32 messageId, uint256 fees) {
    // burn jAsset
    _srcToken.safeTransferFrom(_tokenSender, address(this), _amount);
    _srcToken.burn(_amount);

    // Create an EVM2AnyMessage struct in memory with necessary information for sending a cross-chain message
    Client.EVM2AnyMessage memory evm2AnyMessage = _buildCCIPMessage(
      _destinationChainSelector,
      _messageReceiver,
      _srcToken,
      _destToken,
      _amount,
      _tokenRecipient,
      _feeToken
    );

    // Get the fee required to send the message
    fees = i_router.getFee(_destinationChainSelector, evm2AnyMessage);

    if (_feeToken != address(0)) {
      require(msg.value == 0, 'Native token sent');
      if (!freeFee[_destinationChainSelector]) {
        IERC20(_feeToken).safeTransferFrom(_tokenSender, address(this), fees);
      } else {
        require(
          IERC20(_feeToken).balanceOf(address(this)) >= fees,
          'Not enough balance'
        );
      }

      // approve the Router to transfer LINK tokens on contract's behalf. It will spend the fees in LINK
      IERC20(_feeToken).safeApprove(address(i_router), fees);

      // Send the message through the router and store the returned message ID
      messageId = i_router.ccipSend(_destinationChainSelector, evm2AnyMessage);
    } else {
      // NATIVE TOKEN FEE
      if (!freeFee[_destinationChainSelector]) {
        require(msg.value >= fees, 'Not enough native fees sent');
        uint256 refundAmount = msg.value - fees;
        if (refundAmount > 0) {
          payable(_tokenSender).sendValue(refundAmount);
        }
      } else {
        require(address(this).balance >= fees, 'Not enough balance');
      }

      // Send the message through the router and store the returned message ID
      messageId = i_router.ccipSend{value: fees}(
        _destinationChainSelector,
        evm2AnyMessage
      );
    }
  }

  // build CCIP message to send to the destination chain
  function _buildCCIPMessage(
    uint64 _destinationChainSelector,
    address _messageReceiver,
    IMintableBurnableERC20 _srcToken,
    IMintableBurnableERC20 _destToken,
    uint256 _amount,
    address _tokenRecipient,
    address _feeToken
  ) internal view returns (Client.EVM2AnyMessage memory) {
    // Create an EVM2AnyMessage struct in memory with necessary information for sending a cross-chain message
    Client.EVM2AnyMessage memory evm2AnyMessage = Client.EVM2AnyMessage({
      receiver: abi.encode(_messageReceiver),
      data: abi.encode(_srcToken, _destToken, _amount, _tokenRecipient),
      tokenAmounts: new Client.EVMTokenAmount[](0), // Empty array as no tokens are transferred
      extraArgs: Client._argsToBytes(
        // Additional arguments, setting gas limit and non-strict sequencing mode
        getExtraArgs(_destinationChainSelector)
      ),
      feeToken: _feeToken
    });
    return evm2AnyMessage;
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
