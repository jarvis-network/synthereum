// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity >=0.8.0;

import {
  IMintableBurnableERC20
} from '../../tokens/interfaces/IMintableBurnableERC20.sol';
import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';

interface IMoneyMarketManager {
  // implementation variables
  struct Implementation {
    address implementationAddr;
    bytes moneyMarketArgs;
  }

  /**
   * @notice Registers an address implementing the IJarvisBrrMoneyMarket interface
   * @param _id Identifier of the implementation
   * @param _implementation Address of the implementation
   * @param _extraArgs bytes Encoded args for the implementation
   */
  function registerMoneyMarketImplementation(
    string calldata _id,
    address _implementation,
    bytes calldata _extraArgs
  ) external;

  /**
   * @notice deposits printed jSynth into the money market
   * @param _jSynthAsset address of the jSynth token to deposit
   * @param _amount of jSynth to deposit
   * @param _moneyMarketId identifier of the money market implementation contract to withdraw the tokens from money market
   * @param _implementationCallArgs bytes encoded arguments necessary for this specific implementation call (ie cToken)
   * @return tokensOut amount of eventual tokens received from money market
   */
  function deposit(
    IMintableBurnableERC20 _jSynthAsset,
    uint256 _amount,
    string calldata _moneyMarketId,
    bytes calldata _implementationCallArgs
  ) external returns (uint256 tokensOut);

  /**
   * @notice withdraw jSynth from the money market
   * @dev the same amount must be burned in the same tx
   * @param _jSynthAsset address of the jSynth token to withdraw
   * @param _interestTokenAmount of interest tokens to withdraw
   * @param _moneyMarketId identifier of the money market implementation contract to withdraw the tokens from money market
   * @param _implementationCallArgs bytes encoded arguments necessary for this specific implementation call (ie cToken)
   * @return jSynthOut amount of j Synth in output
   */
  function withdraw(
    IMintableBurnableERC20 _jSynthAsset,
    uint256 _interestTokenAmount,
    string calldata _moneyMarketId,
    bytes calldata _implementationCallArgs
  ) external returns (uint256 jSynthOut);

  /**
   * @notice withdraw generated interest from deposits in money market and sends them to dao
   * @param _jSynthAsset address of the jSynth token to get revenues of
   * @param _recipient address of recipient of revenues
   * @param _moneyMarketId identifier of the money market implementation contract
   * @param _implementationCallArgs bytes encoded arguments necessary for this specific implementation call (ie cToken)
   * @return jSynthOut amount of jSynth sent to the DAO
   */
  function withdrawRevenue(
    IMintableBurnableERC20 _jSynthAsset,
    address _recipient,
    string memory _moneyMarketId,
    bytes memory _implementationCallArgs
  ) external returns (uint256 jSynthOut);

  /**
   * @notice reads the amount of jSynth currently minted + deposited into a money market
   * @param _moneyMarketId identifier of the money market implementation contract
   * @param _jSynthAsset address of the jSynth token to get amount
   * @return amount amount of jSynth currently minted + deposited into moneyMarketId
   */
  function getMoneyMarketDeposited(
    string calldata _moneyMarketId,
    address _jSynthAsset
  ) external view returns (uint256 amount);

  /**
   * @notice reads implementation data of a supported money market
   * @param _moneyMarketId identifier of the money market implementation contract
   * @return implementation Address of the implementation and global data bytes
   */
  function getMoneyMarketImplementation(string calldata _moneyMarketId)
    external
    view
    returns (Implementation memory implementation);
}
