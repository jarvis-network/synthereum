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

  ISynthereumFinder public immutable synthereumFinder;

  mapping(uint64 => MessageEndpoints) internal endpoints;

  mapping(uint64 => Client.EVMExtraArgsV1) internal extraArgs;

  mapping(IMintableBurnableERC20 => mapping(uint64 => IMintableBurnableERC20))
    internal tokensMap;

  mapping(IMintableBurnableERC20 => mapping(uint64 => int256)) chainBridgedAmount;

  mapping(IMintableBurnableERC20 => int256) totalBridgedAmount;

  bool freeFee;

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

  event FreeFeeSet(bool indexed isFree);

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

  constructor(
    ISynthereumFinder _finder,
    address _router,
    Roles memory _roles
  ) CCIPReceiver(_router) {
    synthereumFinder = _finder;
    _setAdmin(_roles.admin);
    _setMaintainer(_roles.maintainer);
  }

  receive() external payable {}

  function setEndpoints(
    uint64 _chainSelector,
    address _msgSender,
    address _msgReceiver
  ) external onlyMaintainer {
    require(i_router.isChainSupported(_chainSelector), 'Chain not supported');
    require(
      _msgSender != address(0) && _msgReceiver != address(0),
      'Null input endpoint'
    );
    endpoints[_chainSelector] = MessageEndpoints(_msgSender, _msgReceiver);
    emit EndpointsSet(_chainSelector, _msgSender, _msgReceiver);
  }

  function removeEndpoints(uint64 _chainSelector) external onlyMaintainer {
    require(
      endpoints[_chainSelector].contractSender != address(0) &&
        endpoints[_chainSelector].contractReceiver != address(0),
      'Endpoints not supported'
    );
    delete endpoints[_chainSelector];
    emit EndpointsRemoved(_chainSelector);
  }

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

  function removeExtraArgs(uint64 _chainSelector) external onlyMaintainer {
    require(extraArgs[_chainSelector].gasLimit != 0, 'Args not supported');
    delete extraArgs[_chainSelector];
    emit ExtraArgsRemoved(_chainSelector);
  }

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

  function setFreeFee(bool _isFree) external onlyMaintainer {
    require(freeFee != _isFree, 'Free fee already set');
    freeFee = _isFree;
    emit FreeFeeSet(_isFree);
  }

  function transferTokensToDestinationChain(
    uint64 _destinationChainSelector,
    address _token,
    uint256 _amount,
    address _recipient,
    address _feeToken
  ) external payable nonReentrant returns (bytes32 messageId, uint256 fees) {
    address messageReceiver = getDestEndpoint(_destinationChainSelector);
    IMintableBurnableERC20 destToken = IMintableBurnableERC20(
      getMappedToken(_token, _destinationChainSelector)
    );

    address msgSender = _msgSender();
    (messageId, fees) = _burnAndSendCCIPMessage(
      _destinationChainSelector,
      messageReceiver,
      IMintableBurnableERC20(_token),
      destToken,
      _amount,
      msgSender,
      _recipient,
      _feeToken
    );

    chainBridgedAmount[IMintableBurnableERC20(_token)][
      _destinationChainSelector
    ] -= _amount.toInt256();
    totalBridgedAmount[IMintableBurnableERC20(_token)] -= _amount.toInt256();

    // Emit an event with message details
    emit TransferInitiated(
      messageId,
      _destinationChainSelector,
      messageReceiver,
      IMintableBurnableERC20(_token),
      destToken,
      _amount,
      msgSender,
      _recipient,
      _feeToken,
      fees
    );
  }

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
      if (!freeFee) {
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
      if (!freeFee) {
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

  function isTokenWhitelisted(address token, uint64 _chainSelector)
    external
    view
    returns (bool)
  {
    return
      address(tokensMap[IMintableBurnableERC20(token)][_chainSelector]) !=
      address(0);
  }

  function isEndpointSupported(uint64 _chainSelector)
    external
    view
    returns (bool)
  {
    return
      endpoints[_chainSelector].contractSender != address(0) &&
      endpoints[_chainSelector].contractReceiver != address(0);
  }

  function isExtraArgsSupported(uint64 _chainSelector)
    external
    view
    returns (bool)
  {
    return extraArgs[_chainSelector].gasLimit != 0;
  }

  function isFeeFree() external view returns (bool) {
    return freeFee;
  }

  function getTotalBridgedAmount(address token) external view returns (int256) {
    return totalBridgedAmount[IMintableBurnableERC20(token)];
  }

  function getChainBridgedAmount(address token, uint64 destChainSelector)
    external
    view
    returns (int256)
  {
    return chainBridgedAmount[IMintableBurnableERC20(token)][destChainSelector];
  }

  function getSrcEndpoint(uint64 _chainSelector)
    public
    view
    returns (address srcEndpoint)
  {
    srcEndpoint = endpoints[_chainSelector].contractSender;
    require(srcEndpoint != address(0), 'Src endpoint not supported');
  }

  function getDestEndpoint(uint64 _chainSelector)
    public
    view
    returns (address destEndpoint)
  {
    destEndpoint = endpoints[_chainSelector].contractReceiver;
    require(destEndpoint != address(0), 'Dest endpoint not supported');
  }

  function getExtraArgs(uint64 _chainSelector)
    public
    view
    returns (Client.EVMExtraArgsV1 memory args)
  {
    args = extraArgs[_chainSelector];
    require(args.gasLimit != 0, 'Args not supported');
  }

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
