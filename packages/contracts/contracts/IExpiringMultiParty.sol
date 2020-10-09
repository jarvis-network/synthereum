pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import {FixedPoint} from './uma-contracts/common/implementation/FixedPoint.sol';
import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';

contract IExpiringMultiParty {
  using FixedPoint for FixedPoint.Unsigned;

  FixedPoint.Unsigned public totalTokensOutstanding;
  IERC20 public tokenCurrency;
  FixedPoint.Unsigned public expiryPrice;

  IERC20 public collateralCurrency;

  function requestWithdrawal(FixedPoint.Unsigned memory collateralAmount)
    public
  {}

  function withdrawPassedRequest() external {}

  function create(
    FixedPoint.Unsigned memory collateralAmount,
    FixedPoint.Unsigned memory numTokens
  ) public {}

  function redeem(FixedPoint.Unsigned memory numTokens) public {}

  function settleExpired() external {}

  function totalPositionCollateral()
    external
    view
    returns (FixedPoint.Unsigned memory)
  {}
}
