// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity >=0.8.0;
import {IMintableBurnableERC20} from '../../tokens/interfaces/IMintableBurnableERC20.sol';
import {Client} from '@chainlink/contracts-ccip/src/v0.8/ccip/libraries/Client.sol';

/**
 * @title Synthereum CCIP bridge interface containing the open functions
 */
interface ISynthereumCCIPBridge {
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
  ) external payable returns (bytes32 messageId, uint256 fees);

  /**
   * @notice Check if a token is whitelisted for a destination chain
   * @param _token Address of the token on this chain
   * @param _chainSelector CCIP chain selector of the destination chain
   * @return True if token is whitelisted, otherwise false
   */
  function isTokenWhitelisted(address _token, uint64 _chainSelector)
    external
    view
    returns (bool);

  /**
   * @notice Check if endpoints are supported for a destination chain
   * @param _chainSelector CCIP chain selector of the destination chain
   * @return True if endpoints are supported, otherwise false
   */
  function isEndpointSupported(uint64 _chainSelector)
    external
    view
    returns (bool);

  /**
   * @notice Check if extra args are supported for a destination chain
   * @param _chainSelector CCIP chain selector of the destination chain
   * @return True if extra args are supported, otherwise false
   */
  function isExtraArgsSupported(uint64 _chainSelector)
    external
    view
    returns (bool);

  /**
   * @notice Check if the fees are free
   * @return True if fee is flat, otherwise false
   */
  function isFeeFree() external view returns (bool);

  /**
   * @notice Amount of bridged token (negative outbound bridge, positive inbound bridge) for every chain
   * @param _token Address of the token
   */
  function getTotalBridgedAmount(address _token) external view returns (int256);

  /**
   * @notice Amount of bridged token (negative outbound bridge, positive inbound bridge) for the input chain
   * @param _token Address of the token
   * @param _destChainSelector CCIP chain selector of the destination chain
   */
  function getChainBridgedAmount(address _token, uint64 _destChainSelector)
    external
    view
    returns (int256);

  /**
   * @notice Get the source endpoint for the input chain
   * @param _chainSelector CCIP chain selector of the source chain
   * @return srcEndpoint Source endpoint
   */
  function getSrcEndpoint(uint64 _chainSelector)
    external
    view
    returns (address srcEndpoint);

  /**
   * @notice Get the destination endpoint for the input chain
   * @param _chainSelector CCIP chain selector of the destination chain
   * @return destEndpoint Destination endpoint
   */
  function getDestEndpoint(uint64 _chainSelector)
    external
    view
    returns (address destEndpoint);

  /**
   * @notice Get the extra-args for the input destination chain
   * @param _chainSelector CCIP chain selector of the destination chain
   * @return args GasLimit and strict
   */
  function getExtraArgs(uint64 _chainSelector)
    external
    view
    returns (Client.EVMExtraArgsV1 memory args);

  /**
   * @notice Get the address of the mapped token with the input token on the input destination chain
   * @param _srcToken Address of the token
   * @param _chainSelector CCIP chain selector of the destination chain
   * @return destToken Address of mapped token on the destination chain
   */
  function getMappedToken(address _srcToken, uint64 _chainSelector)
    external
    view
    returns (address destToken);
}
