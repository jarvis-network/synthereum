// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {IRouterClient} from '@chainlink/contracts-ccip/src/v0.8/ccip/interfaces/IRouterClient.sol';
import {OwnerIsCreator} from '@chainlink/contracts-ccip/src/v0.8/shared/access/OwnerIsCreator.sol';
import {Client} from '@chainlink/contracts-ccip/src/v0.8/ccip/libraries/Client.sol';
import {IERC20} from '@chainlink/contracts-ccip/src/v0.8/vendor/openzeppelin-solidity/v4.8.0/token/ERC20/IERC20.sol';
import {LinkTokenInterface} from '@chainlink/contracts/src/v0.8/interfaces/LinkTokenInterface.sol';
import {IMintableBurnableERC20} from '../tokens/interfaces/IMintableBurnableERC20.sol';
import {CCIPReceiver} from '@chainlink/contracts-ccip/src/v0.8/ccip/applications/CCIPReceiver.sol';

contract JSynthBridge is OwnerIsCreator, CCIPReceiver {
  // Custom errors to provide more descriptive revert messages.
  error NotEnoughBalance(uint256 currentBalance, uint256 calculatedFees); // Used to make sure contract has enough balance to cover the fees.
  error NothingToWithdraw(); // Used when trying to withdraw Ether but there's nothing to withdraw.
  error FailedToWithdrawEth(address owner, address target, uint256 value); // Used when the withdrawal of Ether fails.
  error ChainNotWhiteListed(uint64 destinationChainSelector); // Used when the destination chain has not been whitelisted by the contract owner.

  // Event emitted when the tokens are burned on the source chain and the message sent to ccipi
  event TransferInitiated(
    bytes32 indexed messageId,
    uint64 indexed destinationChainSelector,
    address sender,
    address receiver,
    address token,
    uint256 tokenAmount,
    address feeToken,
    uint256 fees
  );

  // Event emitted when message is received from ccip and the tokens are minted on the destination chain
  event TransferCompleted(
    bytes32 indexed messageId,
    uint64 indexed destinationChainSelector,
    address token,
    address receiver,
    uint256 tokenAmount
  );

  // Mapping to keep track of whitelisted destination chains from the chain this gets deployed to, for each jAsset.
  mapping(address => mapping(uint64 => bool)) public whitelistedChainsForAsset;

  IRouterClient router;
  LinkTokenInterface linkToken;

  receive() external payable {}

  constructor(address _router, address _link) CCIPReceiver(_router) {
    router = IRouterClient(_router);
    linkToken = LinkTokenInterface(_link);
  }

  function whitelistChain(address token, uint64 _chainSelector)
    external
    onlyOwner
  {
    whitelistedChainsForAsset[token][_chainSelector] = true;
  }

  function denylistChain(address token, uint64 _chainSelector)
    external
    onlyOwner
  {
    whitelistedChainsForAsset[token][_chainSelector] = false;
  }

  function transferTokensToDestinationChain(
    uint64 _destinationChainSelector,
    address _messageRecipient,
    address _tokensRecipient,
    address _token,
    address _feeToken,
    uint256 _amount
  ) external returns (bytes32 messageId) {
    _onlyWhitelistedChain(_token, _destinationChainSelector);

    uint256 fees;
    (messageId, fees) = _burnAndSendCCIPMessage(
      _destinationChainSelector,
      _messageRecipient,
      _tokensRecipient,
      _token,
      _feeToken,
      _amount
    );

    // Emit an event with message details
    emit TransferInitiated(
      messageId,
      _destinationChainSelector,
      _tokensRecipient,
      _messageRecipient,
      _token,
      _amount,
      _feeToken,
      fees
    );

    // Return the message ID
    return messageId;
  }

  function _ccipReceive(Client.Any2EVMMessage memory message)
    internal
    override
  {
    // decode cross chain message
    (address token, address recipient, uint256 amount) = abi.decode(
      message.data,
      (address, address, uint256)
    );

    // validate origin chain
    _onlyWhitelistedChain(token, message.sourceChainSelector);

    // mint token to recipient
    IMintableBurnableERC20(token).mint(recipient, amount);

    emit TransferCompleted(
      message.messageId,
      message.sourceChainSelector,
      token,
      recipient,
      amount
    );
  }

  function _burnAndSendCCIPMessage(
    uint64 _destinationChainSelector,
    address _messageRecipient,
    address _tokensRecipient,
    address _token,
    address _feeToken,
    uint256 _amount
  ) internal returns (bytes32 messageId, uint256 fees) {
    // burn jAsset
    IERC20(_token).transferFrom(msg.sender, address(this), _amount);
    IMintableBurnableERC20(_token).burn(_amount);

    // Create an EVM2AnyMessage struct in memory with necessary information for sending a cross-chain message
    Client.EVM2AnyMessage memory evm2AnyMessage = _buildCCIPMessage(
      _tokensRecipient,
      _messageRecipient,
      _token,
      address(_feeToken),
      _amount
    );

    // Get the fee required to send the message
    fees = router.getFee(_destinationChainSelector, evm2AnyMessage);

    if (_feeToken != address(0)) {
      // LINK FEE
      if (fees > linkToken.balanceOf(address(this)))
        revert NotEnoughBalance(linkToken.balanceOf(address(this)), fees);

      // approve the Router to transfer LINK tokens on contract's behalf. It will spend the fees in LINK
      linkToken.approve(address(router), fees);

      // Send the message through the router and store the returned message ID
      messageId = router.ccipSend(_destinationChainSelector, evm2AnyMessage);
    } else {
      // NATIVE TOKEN FEE
      if (fees > address(this).balance)
        revert NotEnoughBalance(address(this).balance, fees);

      // Send the message through the router and store the returned message ID
      messageId = router.ccipSend{value: fees}(
        _destinationChainSelector,
        evm2AnyMessage
      );
    }
  }

  function _buildCCIPMessage(
    address _tokenRecipient,
    address _messageReceiver,
    address _asset,
    address _feeTokenAddress,
    uint256 _amount
  ) internal pure returns (Client.EVM2AnyMessage memory) {
    // Create an EVM2AnyMessage struct in memory with necessary information for sending a cross-chain message
    Client.EVM2AnyMessage memory evm2AnyMessage = Client.EVM2AnyMessage({
      receiver: abi.encode(_messageReceiver),
      data: abi.encode(_asset, _tokenRecipient, _amount),
      tokenAmounts: new Client.EVMTokenAmount[](0), // Empty array as no tokens are transferred
      extraArgs: Client._argsToBytes(
        // Additional arguments, setting gas limit and non-strict sequencing mode
        Client.EVMExtraArgsV1({gasLimit: 200_000, strict: false})
      ),
      feeToken: _feeTokenAddress
    });
    return evm2AnyMessage;
  }

  function _onlyWhitelistedChain(
    address token,
    uint64 _destinationChainSelector
  ) internal view {
    if (!whitelistedChainsForAsset[token][_destinationChainSelector])
      revert ChainNotWhiteListed(_destinationChainSelector);
  }

  function withdraw(address _beneficiary) public onlyOwner {
    // Retrieve the balance of this contract
    uint256 amount = address(this).balance;

    // Revert if there is nothing to withdraw
    if (amount == 0) revert NothingToWithdraw();

    // Attempt to send the funds, capturing the success status and discarding any return data
    (bool sent, ) = _beneficiary.call{value: amount}('');

    // Revert if the send failed, with information about the attempted transfer
    if (!sent) revert FailedToWithdrawEth(msg.sender, _beneficiary, amount);
  }

  function withdrawToken(address _beneficiary, address _token)
    public
    onlyOwner
  {
    // Retrieve the balance of this contract
    uint256 amount = IERC20(_token).balanceOf(address(this));

    // Revert if there is nothing to withdraw
    if (amount == 0) revert NothingToWithdraw();

    IERC20(_token).transfer(_beneficiary, amount);
  }
}
