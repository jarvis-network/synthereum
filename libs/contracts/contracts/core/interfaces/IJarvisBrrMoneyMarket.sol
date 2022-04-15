// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity >=0.8.0;

import {
  IMintableBurnableERC20
} from '../../tokens/interfaces/IMintableBurnableERC20.sol';

interface IJarvisBrrMoneyMarket {
  /**
   * @notice deposits printed jSynth into the money market
   * @param amount of jSynth to deposit
   * @return tokensOut amount of eventual tokens received from money market
   */
  function deposit(
    IMintableBurnableERC20 token,
    uint256 amount,
    bytes memory lendingArgs
  ) external returns (uint256 tokensOut);
}
