// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import '../FixedRateWrapper.sol';

contract Maastricht is FixedRateWrapper {
  constructor(IERC20 _token)
    FixedRateWrapper(_token, 6559570 * 1e12, 'Jarvis Synthetic Franc', 'jFRF')
  {}
}
