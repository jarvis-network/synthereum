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

interface ICreditLineStorage {
  // Describe role structure
  struct Roles {
    address admin;
    address[] maintainers;
  }

  // Describe fee structure
  struct Fee {
    // Fees charged when a user mints, redeem and exchanges tokens
    FixedPoint.Unsigned feePercentage;
    // Recipient receiving fees
    address[] feeRecipients;
    // Proportion for each recipient
    uint32[] feeProportions;
    // Used with individual proportions to scale values
    uint256 totalFeeProportions;
  }

  struct FeeStatus {
    // Track the fee gained to be withdrawn by an address
    mapping(address => FixedPoint.Unsigned) feeGained;
    // Total amount of fees to be withdrawn
    FixedPoint.Unsigned totalFeeAmount;
  }

  // Represents a single sponsor's position. All collateral is held by this contract.
  // This struct acts as bookkeeping for how much of that collateral is allocated to each sponsor.
  struct PositionData {
    FixedPoint.Unsigned tokensOutstanding;
    FixedPoint.Unsigned rawCollateral;
  }

  struct GlobalPositionData {
    // Keep track of the total collateral and tokens across all positions
    FixedPoint.Unsigned totalTokensOutstanding;
    // Similar to the rawCollateral in PositionData, this value should not be used directly.
    //_getFeeAdjustedCollateral(), _addCollateral() and _removeCollateral() must be used to access and adjust.
    FixedPoint.Unsigned rawTotalPositionCollateral;
  }

  struct PositionManagerData {
    // SynthereumFinder contract
    ISynthereumFinder synthereumFinder;
    // Collateral token
    IStandardERC20 collateralToken;
    // Synthetic token created by this contract.
    BaseControlledMintableBurnableERC20 tokenCurrency;
    // Unique identifier for DVM price feed ticker.
    bytes32 priceIdentifier;
    // Overcollateralization percentage
    FixedPoint.Unsigned overCollateralization;
    // percentage of collateral liquidated as reward to liquidator
    FixedPoint.Unsigned liquidatorRewardPct;
    // Minimum number of tokens in a sponsor's position.
    FixedPoint.Unsigned minSponsorTokens;
    // Expiry price pulled from Chainlink in the case of an emergency shutdown.
    FixedPoint.Unsigned emergencyShutdownPrice;
    // Timestamp used in case of emergency shutdown.
    uint256 emergencyShutdownTimestamp;
    // The excessTokenBeneficiary of any excess tokens added to the contract.
    address excessTokenBeneficiary;
    // Version of the self-minting derivative
    uint8 version;
  }

  struct LiquidationData {
    address sponsor;
    address liquidator;
    uint256 liquidationTime;
    uint256 numTokensBurnt;
    uint256 liquidatedCollateral;
  }
}
