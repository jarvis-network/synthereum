// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {ISynthereumFinder} from '../../../core/interfaces/IFinder.sol';
import {
  FixedPoint
} from '@jarvis-network/uma-core/contracts/common/implementation/FixedPoint.sol';

interface IDerivativeMain {
  function depositTo(
    address sponsor,
    FixedPoint.Unsigned memory collateralAmount
  ) external;

  function deposit(FixedPoint.Unsigned memory collateralAmount) external;

  function withdraw(FixedPoint.Unsigned memory collateralAmount)
    external
    returns (FixedPoint.Unsigned memory amountWithdrawn);

  function requestWithdrawal(FixedPoint.Unsigned memory collateralAmount)
    external;

  function withdrawPassedRequest()
    external
    returns (FixedPoint.Unsigned memory amountWithdrawn);

  function cancelWithdrawal() external;

  function create(
    FixedPoint.Unsigned memory collateralAmount,
    FixedPoint.Unsigned memory numTokens
  ) external;

  function redeem(FixedPoint.Unsigned memory numTokens)
    external
    returns (FixedPoint.Unsigned memory amountWithdrawn);

  function repay(FixedPoint.Unsigned memory numTokens) external;

  function settleEmergencyShutdown()
    external
    returns (FixedPoint.Unsigned memory amountWithdrawn);

  function emergencyShutdown() external;

  function remargin() external;

  function trimExcess(IERC20 token)
    external
    returns (FixedPoint.Unsigned memory amount);

  function getCollateral(address sponsor)
    external
    view
    returns (FixedPoint.Unsigned memory collateralAmount);

  function synthereumFinder() external view returns (ISynthereumFinder finder);

  function syntheticTokenSymbol() external view returns (string memory symbol);

  function priceIdentifier() external view returns (bytes32 identifier);

  function totalPositionCollateral()
    external
    view
    returns (FixedPoint.Unsigned memory totalCollateral);

  function totalTokensOutstanding()
    external
    view
    returns (FixedPoint.Unsigned memory totalTokens);

  function emergencyShutdownPrice()
    external
    view
    returns (FixedPoint.Unsigned memory emergencyPrice);
}
