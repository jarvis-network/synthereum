// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.4;

import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {SafeMath} from '@openzeppelin/contracts/utils/math/SafeMath.sol';
import {
  FixedPoint
} from '@uma/core/contracts/common/implementation/FixedPoint.sol';
import {
  SafeERC20
} from '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import {FeePayerPartyLib} from '../../common/FeePayerPartyLib.sol';
import {
  PerpetualPositionManagerMultiPartyLib
} from './PerpetualPositionManagerMultiPartyLib.sol';
import {
  PerpetualLiquidatableMultiPartyLib
} from './PerpetualLiquidatableMultiPartyLib.sol';
import {
  PerpetualPositionManagerMultiParty
} from './PerpetualPositionManagerMultiParty.sol';

/**
 * @title PerpetualLiquidatableMultiParty
 * @notice Adds logic to a position-managing contract that enables callers to liquidate an undercollateralized position.
 * @dev The liquidation has a liveness period before expiring successfully, during which someone can "dispute" the
 * liquidation, which sends a price request to the relevant Oracle to settle the final collateralization ratio based on
 * a DVM price. The contract enforces dispute rewards in order to incentivize disputers to correctly dispute false
 * liquidations and compensate position sponsors who had their position incorrectly liquidated. Importantly, a
 * prospective disputer must deposit a dispute bond that they can lose in the case of an unsuccessful dispute.
 */
contract PerpetualLiquidatableMultiParty is PerpetualPositionManagerMultiParty {
  using FixedPoint for FixedPoint.Unsigned;
  using SafeMath for uint256;
  using SafeERC20 for IERC20;
  using FeePayerPartyLib for FixedPoint.Unsigned;
  using PerpetualLiquidatableMultiPartyLib for PerpetualPositionManagerMultiParty.PositionData;
  using PerpetualLiquidatableMultiPartyLib for LiquidationData;

  // Because of the check in withdrawable(), the order of these enum values should not change.
  enum Status {
    Uninitialized,
    PreDispute,
    PendingDispute,
    DisputeSucceeded,
    DisputeFailed
  }

  // Store parameters for liquidation
  struct LiquidatableParams {
    uint256 liquidationLiveness;
    FixedPoint.Unsigned collateralRequirement;
    FixedPoint.Unsigned disputeBondPct;
    FixedPoint.Unsigned sponsorDisputeRewardPct;
    FixedPoint.Unsigned disputerDisputeRewardPct;
  }

  struct LiquidationData {
    address sponsor;
    address liquidator;
    uint256 liquidationTime;
    uint256 numTokensBurnt;
    uint256 liquidatedCollateral;
  }

  // Define the contract's constructor parameters as a struct to enable more variables to be specified.
  // This is required to enable more params, over and above Solidity's limits.
  struct ConstructorParams {
    // Params for PricelessPositionManager only
    PerpetualPositionManagerMultiParty.PositionManagerParams positionManagerParams;
    // Params specifically for Liquidatable.
    LiquidatableParams liquidatableParams;
  }

  // This struct is used in the `withdrawLiquidation` method that disperses liquidation and dispute rewards.
  // `payToX` stores the total collateral to withdraw from the contract to pay X. This value might differ
  // from `paidToX` due to precision loss between accounting for the `rawCollateral` versus the
  // fee-adjusted collateral. These variables are stored within a struct to avoid the stack too deep error.
  struct RewardsData {
    FixedPoint.Unsigned payToSponsor;
    FixedPoint.Unsigned payToLiquidator;
    FixedPoint.Unsigned payToDisputer;
    FixedPoint.Unsigned paidToSponsor;
    FixedPoint.Unsigned paidToLiquidator;
    FixedPoint.Unsigned paidToDisputer;
  }

  //----------------------------------------
  // Storage
  //----------------------------------------

  // Liquidations are unique by ID per sponsor
  mapping(address => LiquidationData[]) public liquidations;

  //----------------------------------------
  // Events
  //----------------------------------------
  event Liquidation(
    address indexed sponsor,
    address indexed liquidator,
    uint256 liquidatedTokens,
    uint256 liquidatedCollateral,
    uint256 collateralReward,
    uint256 liquidationTime
  );

  //----------------------------------------
  // Constructor
  //----------------------------------------

  /**
   * @notice Constructs the PerpetualPositionManagerMultiParty contract
   * @param params struct to define input parameters for construction of Liquidatable. Some params
   * are fed directly into the PositionManager's constructor within the inheritance tree.
   */
  constructor(ConstructorParams memory params)
    PerpetualPositionManagerMultiParty(params.positionManagerParams)
  {
    require(
      params.liquidatableParams.collateralRequirement.isGreaterThan(1),
      'CR is more than 100%'
    );

    require(
      params
        .liquidatableParams
        .sponsorDisputeRewardPct
        .add(params.liquidatableParams.disputerDisputeRewardPct)
        .isLessThan(1),
      'Rewards are more than 100%'
    );

    // liquidatableData.liquidationLiveness = params
    //   .liquidatableParams
    //   .liquidationLiveness;
    // liquidatableData.collateralRequirement = params
    //   .liquidatableParams
    //   .collateralRequirement;
    // liquidatableData.disputeBondPct = params.liquidatableParams.disputeBondPct;
    // liquidatableData.sponsorDisputeRewardPct = params
    //   .liquidatableParams
    //   .sponsorDisputeRewardPct;
    // liquidatableData.disputerDisputeRewardPct = params
    //   .liquidatableParams
    //   .disputerDisputeRewardPct;
  }

  //----------------------------------------
  // External functions
  //----------------------------------------

  function liquidate(
    address sponsor,
    FixedPoint.Unsigned calldata maxTokensToLiquidate
  )
    external
    fees()
    notEmergencyShutdown()
    nonReentrant()
    returns (
      uint256 tokensLiquidated,
      uint256 collateralLiquidated,
      uint256 collateralReward
    )
  {
    // Retrieve Position data for sponsor
    PositionData storage positionToLiquidate = _getPositionData(sponsor);

    // try to liquidate it - reverts if is properly collateralised
    (
      collateralLiquidated,
      tokensLiquidated,
      collateralReward
    ) = positionToLiquidate.liquidate(
      positionManagerData,
      globalPositionData,
      feePayerData,
      sponsor,
      maxTokensToLiquidate
    );

    // store new liquidation
    liquidations[sponsor].push(
      LiquidationData(
        sponsor,
        msg.sender,
        getCurrentTime(),
        tokensLiquidated,
        collateralLiquidated
      )
    );

    emit Liquidation(
      sponsor,
      msg.sender,
      collateralLiquidated,
      tokensLiquidated,
      collateralReward,
      getCurrentTime()
    );
  }

  /**
   * @notice Gets an array of liquidations performed on a token sponsor
   * @param sponsor address of the TokenSponsor.
   * @return liquidationData An array of data for all liquidations performed on a token sponsor
   */
  function getLiquidations(address sponsor)
    external
    view
    nonReentrantView()
    returns (LiquidationData[] memory liquidationData)
  {
    return liquidations[sponsor];
  }

  //----------------------------------------
  // Internal functions
  //----------------------------------------
  /** @notice A helper function for getLiquidationData function
   */
  function _getLiquidationData(address sponsor, uint256 liquidationId)
    internal
    view
    returns (LiquidationData storage liquidation)
  {
    LiquidationData[] storage liquidationArray = liquidations[sponsor];
    // Revert if the caller is attempting to access an invalid liquidation
    // (one that has never been created or one has never been initialized).
    require(liquidationId < liquidationArray.length, 'Invalid liquidation ID');
    return liquidationArray[liquidationId];
  }
}
