// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import '../FixedRateWrapper.sol';

contract Maastricht is FixedRateWrapper {
  /** @notice - The Maastricht contract inherits from the FixedRateWrapper and
   * is used to issue and burn legacy synthetic franc tokens
   * @param _token - The synthetic token to which the franc is pegged (jEUR)
   */
  constructor(IERC20 _token)
    FixedRateWrapper(_token, 6559570 * 1e12, 'Jarvis Synthetic Franc', 'jFRF')
  {}
}
