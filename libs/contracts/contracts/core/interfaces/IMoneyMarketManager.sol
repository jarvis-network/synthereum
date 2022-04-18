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
    string memory id,
    address implementation,
    bytes memory extraArgs
  ) external;

  /**
   * @notice deposits printed jSynth into the money market
   * @param jSynthAsset address of the jSynth token to deposit
   * @param amount of jSynth to deposit
   * @param moneyMarketId identifier of the money market implementation contract to withdraw the tokens from money market
   * @return tokensOut amount of eventual tokens received from money market
   */
  function deposit(
    IMintableBurnableERC20 jSynthAsset,
    uint256 amount,
    string memory moneyMarketId
  ) external returns (uint256 tokensOut);

  /**
   * @notice withdraw jSynth from the money market
   * @dev the same amount must be burned in the same tx
   * @param interestTokenAmount of interest tokens to withdraw
   * @param interestToken address of the interest token
   * @param jSynthAsset address of the jSynth token to withdraw
   * @param moneyMarketId identifier of the money market implementation contract to withdraw the tokens from money market
   * @return jSynthOut amount of j Synth in output
   */
  function withdraw(
    IERC20 interestToken,
    IMintableBurnableERC20 jSynthAsset,
    uint256 interestTokenAmount,
    string memory moneyMarketId
  ) external returns (uint256 jSynthOut);
}
