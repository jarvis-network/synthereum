// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.6.12;

import {IERC20} from '../../@openzeppelin/contracts/token/ERC20/IERC20.sol';

contract DerivativeMock {
  IERC20 private collateral;
  IERC20 private token;

  constructor(IERC20 _collateral, IERC20 _token) public {
    collateral = _collateral;
    token = _token;
  }

  function collateralCurrency() external view returns (IERC20) {
    return collateral;
  }

  function tokenCurrency() external view returns (IERC20 syntheticCurrency) {
    return token;
  }
}
