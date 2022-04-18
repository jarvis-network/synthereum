// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity >=0.8.0;

import {
  IMintableBurnableERC20
} from '../../tokens/interfaces/IMintableBurnableERC20.sol';
import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';

interface IJarvisBrrMoneyMarket {
  /**
   * @notice deposits printed jSynth into the money market
   * @param amount of jSynth to deposit
   * @param jSynthAsset address of the jSynth token to deposit
   * @param extraArgs bytes Encoded args for the implementation
   * @return tokensOut amount of eventual tokens received from money market
   */
  function deposit(
    IMintableBurnableERC20 jSynthAsset,
    uint256 amount,
    bytes memory extraArgs
  ) external returns (uint256 tokensOut);

  /**
   * @notice withdraw jSynth from the money market
   * @dev the same amount must be burned in the same tx
   * @param interestTokenAmount of interest tokens to withdraw
   * @param interestToken address of the interest token
   * @param jSynthAsset address of the jSynth token to withdraw
   * @param extraArgs bytes Encoded args for the implementation
   * @return jSynthOut amount of j Synth in output
   */
  function withdraw(
    IERC20 interestToken,
    IMintableBurnableERC20 jSynthAsset,
    uint256 interestTokenAmount,
    bytes memory extraArgs
  ) external returns (uint256 jSynthOut);
}
