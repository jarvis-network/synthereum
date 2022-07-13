// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity >=0.8.0;

import {
  IMintableBurnableERC20
} from '../../tokens/interfaces/IMintableBurnableERC20.sol';
import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';

interface IMoneyMarketManager {
  /**
   * @notice Registers an address implementing the IJarvisBrrMoneyMarket interface
   * @param id Identifier of the implementation
   * @param implementation Address of the implementation
   * @param extraArgs bytes Encoded args for the implementation
   */
  function registerMoneyMarketImplementation(
    string calldata id,
    address implementation,
    bytes calldata extraArgs
  ) external;

  /**
   * @notice deposits printed jSynth into the money market
   * @param jSynthAsset address of the jSynth token to deposit
   * @param amount of jSynth to deposit
   * @param moneyMarketId identifier of the money market implementation contract to withdraw the tokens from money market
   * @param implementationCallArgs bytes encoded arguments necessary for this specific implementation call (ie cToken)
   * @return tokensOut amount of eventual tokens received from money market
   */
  function deposit(
    IMintableBurnableERC20 jSynthAsset,
    uint256 amount,
    string calldata moneyMarketId,
    bytes calldata implementationCallArgs
  ) external returns (uint256 tokensOut);

  /**
   * @notice withdraw jSynth from the money market
   * @dev the same amount must be burned in the same tx
   * @param interestTokenAmount of interest tokens to withdraw
   * @param jSynthAsset address of the jSynth token to withdraw
   * @param moneyMarketId identifier of the money market implementation contract to withdraw the tokens from money market
   * @param implementationCallArgs bytes encoded arguments necessary for this specific implementation call (ie cToken)
   * @return jSynthOut amount of j Synth in output
   */
  function withdraw(
    IMintableBurnableERC20 jSynthAsset,
    uint256 interestTokenAmount,
    string calldata moneyMarketId,
    bytes calldata implementationCallArgs
  ) external returns (uint256 jSynthOut);

  /**
   * @notice withdraw generated interest from deposits in money market and sends them to dao
   * @param jSynthAsset address of the jSynth token to get revenues of
   * @param recipient address of recipient of revenues
   * @param moneyMarketId identifier of the money market implementation contract
   * @param implementationCallArgs bytes encoded arguments necessary for this specific implementation call (ie cToken)
   * @return jSynthOut amount of jSynth sent to the DAO
   */
  function withdrawRevenue(
    IMintableBurnableERC20 jSynthAsset,
    address recipient,
    string memory moneyMarketId,
    bytes memory implementationCallArgs
  ) external returns (uint256 jSynthOut);

  /**
   * @notice reads the amount of jSynth currently minted + deposited into a money market
   * @param jSynthAsset address of the jSynth token to get amount
   * @param moneyMarketId identifier of the money market implementation contract
   * @return amount amount of jSynth currently minted + deposited into moneyMarketId
   */
  function getMoneyMarketDeposited(
    address jSynthAsset,
    string calldata moneyMarketId
  ) external view returns (uint256 amount);
}
