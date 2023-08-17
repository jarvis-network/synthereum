// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity >=0.8.0;
import {IMintableBurnableERC20} from '../../tokens/interfaces/IMintableBurnableERC20.sol';
import {Client} from '@chainlink/contracts-ccip/src/v0.8/ccip/libraries/Client.sol';

interface ISynthereumCCIPBridge {
  function transferTokensToDestinationChain(
    uint64 _destinationChainSelector,
    address _token,
    uint256 _amount,
    address _recipient,
    address _feeToken
  ) external payable returns (bytes32 messageId, uint256 fees);

  function isTokenWhitelisted(address token, uint64 _chainSelector)
    external
    view
    returns (bool);

  function isEndpointSupported(uint64 _chainSelector)
    external
    view
    returns (bool);

  function isExtraArgsSupported(uint64 _chainSelector)
    external
    view
    returns (bool);

  function isFeeFree() external view returns (bool);

  function getDestEndpoint(uint64 _chainSelector)
    external
    view
    returns (address destEndpoint);

  function getSrcEndpoint(uint64 _chainSelector)
    external
    view
    returns (address srcEndpoint);

  function getExtraArgs(uint64 _chainSelector)
    external
    view
    returns (Client.EVMExtraArgsV1 memory args);

  function getMappedToken(
    IMintableBurnableERC20 _srcToken,
    uint64 _chainSelector
  ) external view returns (IMintableBurnableERC20 destToken);
}
