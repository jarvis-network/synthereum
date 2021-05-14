// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import {IERC20} from '../../@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {ISynthereumFinder} from '../core/interfaces/IFinder.sol';
import {
  FixedPoint
} from '../../@jarvis-network/uma-core/contracts/common/implementation/FixedPoint.sol';

contract DerivativeMock {
  struct PositionManagerParams {
    uint256 withdrawalLiveness;
    address collateralAddress;
    address tokenAddress;
    address finderAddress;
    bytes32 priceFeedIdentifier;
    FixedPoint.Unsigned minSponsorTokens;
    address timerAddress;
    address excessTokenBeneficiary;
    ISynthereumFinder synthereumFinder;
  }

  IERC20 private collateral;
  IERC20 private token;
  PositionManagerParams public positionManagerData;

  constructor(
    IERC20 _collateral,
    IERC20 _token,
    bytes32 _priceFeedIdentifier
  ) public {
    collateral = _collateral;
    token = _token;
    positionManagerData.priceFeedIdentifier = _priceFeedIdentifier;
  }

  function collateralCurrency() external view returns (IERC20) {
    return collateral;
  }

  function tokenCurrency() external view returns (IERC20 syntheticCurrency) {
    return token;
  }
}
