// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import '../FixedRateWrapper.sol';

contract Maastricht is FixedRateWrapper {
  constructor(IERC20 _token, uint256 _rate)
    FixedRateWrapper(_token, _rate, 'Jarvis Synthetic Franc', 'jFRF')
  {}
}
