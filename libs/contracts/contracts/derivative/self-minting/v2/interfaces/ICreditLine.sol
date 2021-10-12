// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.4;

import {
  FixedPoint
} from '@uma/core/contracts/common/implementation/FixedPoint.sol';
import {ISynthereumFinder} from '../../../../core/interfaces/IFinder.sol';
import {IStandardERC20} from '../../../../base/interfaces/IStandardERC20.sol';
import {
  BaseControlledMintableBurnableERC20
} from '../../../../tokens/interfaces/BaseControlledMintableBurnableERC20.sol';
import {
  ICreditLineDerivativeDeployment
} from './ICreditLineDerivativeDeployment.sol';
import {ICreditLineStorage} from './ICreditLineStorage.sol';

interface ICreditLine is ICreditLineDerivativeDeployment {
  function deposit(uint256 collateralAmount) external;

  function withdraw(uint256 collateralAmount)
    external
    returns (uint256 amountWithdrawn);

  function create(uint256 collateralAmount, uint256 numTokens)
    external
    returns (uint256 feeAmount);

  function redeem(uint256 numTokens)
    external
    returns (uint256 amountWithdrawn, uint256 feeAmount);

  function repay(uint256 numTokens) external returns (uint256 daoFeeAmount);

  function settleEmergencyShutdown() external returns (uint256 amountWithdrawn);

  function emergencyShutdown() external;

  function claimFee() external returns (uint256 feeClaimed);

  function getCapMintAmount() external view returns (uint256 capMint);

  function getLiquidationReward() external view returns (uint256);

  function getFeeInfo() external view returns (ICreditLineStorage.Fee memory);

  function getOvercollateralization() external view returns (uint256);

  function getLiquidations(address sponsor)
    external
    view
    returns (ICreditLineStorage.LiquidationData[] memory);

  function deleteSponsorPosition(address sponsor) external;

  function getPositionCollateral(address sponsor)
    external
    returns (FixedPoint.Unsigned memory collateralAmount);

  function liquidate(
    address sponsor,
    FixedPoint.Unsigned calldata maxTokensToLiquidate
  )
    external
    returns (
      uint256 tokensLiquidated,
      uint256 collateralLiquidated,
      uint256 collateralReward
    );
}
