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
   * @param implementationCallArgs bytes encoded arguments necessary for this specific implementation call (ie cToken)
   * @return tokensOut amount of eventual tokens received from money market
   */
  function deposit(
    IMintableBurnableERC20 jSynthAsset,
    uint256 amount,
    bytes calldata extraArgs,
    bytes calldata implementationCallArgs
  ) external returns (uint256 tokensOut);

  /**
   * @notice withdraw jSynth from the money market
   * @dev the same amount must be burned in the same tx
   * @param jSynthAsset address of the jSynth token to withdraw
   * @param interestTokenAmount of interest tokens to withdraw
   * @param extraArgs bytes Encoded args for the implementation
   * @param implementationCallArgs bytes encoded arguments necessary for this specific implementation call (ie cToken)
   * @return jSynthOut amount of j Synth in output
   */
  function withdraw(
    IMintableBurnableERC20 jSynthAsset,
    uint256 interestTokenAmount,
    bytes calldata extraArgs,
    bytes calldata implementationCallArgs
  ) external returns (uint256 jSynthOut);

  /**
   * @notice returns the total deposited + interest generated in the money market
   * @param jSynthAsset address of the jSynth token to get corresponding balance
   * @param args general bytes Encoded args for the implementation
   * @param implementationCallArgs bytes encoded arguments necessary for this specific implementation call (ie cToken)
   * @return totalJSynth total amount of jSynth
   */
  function getTotalBalance(
    address jSynthAsset,
    bytes calldata args,
    bytes calldata implementationCallArgs
  ) external returns (uint256 totalJSynth);
}
