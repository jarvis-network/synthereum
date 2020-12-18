// SPDX-License-Identifier
pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {IDerivativeDeployment} from './IDerivativeDeployment.sol';
import {
  FinderInterface
} from '@jarvis-network/uma-core/contracts/oracle/interfaces/FinderInterface.sol';
import {
  FixedPoint
} from '@jarvis-network/uma-core/contracts/common/implementation/FixedPoint.sol';

/**
 * @title Interface of perpetual derivative contract
 */

interface IDerivative is IDerivativeDeployment {
  struct FeePayerData {
    // The collateral currency used to back the positions in this contract.
    IERC20 collateralCurrency;
    // Finder contract used to look up addresses for UMA system contracts.
    FinderInterface finder;
    // Tracks the last block time when the fees were paid.
    uint256 lastPaymentTime;
    // Tracks the cumulative fees that have been paid by the contract for use by derived contracts.
    // The multiplier starts at 1, and is updated by computing cumulativeFeeMultiplier * (1 - effectiveFee).
    // Put another way, the cumulativeFeeMultiplier is (1 - effectiveFee1) * (1 - effectiveFee2) ...
    // For example:
    // The cumulativeFeeMultiplier should start at 1.
    // If a 1% fee is charged, the multiplier should update to .99.
    // If another 1% fee is charged, the multiplier should be 0.99^2 (0.9801).
    FixedPoint.Unsigned cumulativeFeeMultiplier;
  }

  struct PositionManagerData {
    // Synthetic token created by this contract.
    IERC20 tokenCurrency;
    // Unique identifier for DVM price feed ticker.
    bytes32 priceIdentifier;
    // Time that has to elapse for a withdrawal request to be considered passed, if no liquidations occur.
    // !!Note: The lower the withdrawal liveness value, the more risk incurred by the contract.
    //       Extremely low liveness values increase the chance that opportunistic invalid withdrawal requests
    //       expire without liquidation, thereby increasing the insolvency risk for the contract as a whole. An insolvent
    //       contract is extremely risky for any sponsor or synthetic token holder for the contract.
    uint256 withdrawalLiveness;
    // Minimum number of tokens in a sponsor's position.
    FixedPoint.Unsigned minSponsorTokens;
    // Expiry price pulled from the DVM in the case of an emergency shutdown.
    FixedPoint.Unsigned emergencyShutdownPrice;
    // Timestamp used in case of emergency shutdown.
    uint256 emergencyShutdownTimestamp;
    // The excessTokenBeneficiary of any excess tokens added to the contract.
    address excessTokenBeneficiary;
  }

  // Maps sponsor addresses to their positions. Each sponsor can have only one position.

  struct GlobalPositionData {
    // Keep track of the total collateral and tokens across all positions to enable calculating the
    // global collateralization ratio without iterating over all positions.
    FixedPoint.Unsigned totalTokensOutstanding;
    // Similar to the rawCollateral in PositionData, this value should not be used directly.
    // _getFeeAdjustedCollateral(), _addCollateral() and _removeCollateral() must be used to access and adjust.
    FixedPoint.Unsigned rawTotalPositionCollateral;
  }

  /**
   * @notice Get data of feePayerPoolParty contract that is based contract of perpetual derivative
   * @return data Data of feePayerPoolParty contract
   */
  function feePayerData() external view returns (FeePayerData memory data);

  /**
   * @notice Get position data of perpetual derivative
   * @return data Data of PerpetualPositionManagerPoolParty contract
   */
  function positionManagerData()
    external
    view
    returns (PositionManagerData memory data);

  /**
   * @notice Get global position data of perpetual derivative
   * @return data Data of feePayerPoolParty contract
   */
  function globalPositionData()
    external
    view
    returns (GlobalPositionData memory data);

  /**
   * @notice Transfers `collateralAmount` of `feePayerData.collateralCurrency` into the specified sponsor's position.
   * @dev Increases the collateralization level of a position after creation. This contract must be approved to spend
   * at least `collateralAmount` of `feePayerData.collateralCurrency`.
   * @param sponsor the sponsor to credit the deposit to.
   * @param collateralAmount total amount of collateral tokens to be sent to the sponsor's position.
   */
  function depositTo(
    address sponsor,
    FixedPoint.Unsigned memory collateralAmount
  ) external;

  /**
   * @notice Transfers `collateralAmount` of `feePayerData.collateralCurrency` into the caller's position.
   * @dev Increases the collateralization level of a position after creation. This contract must be approved to spend
   * at least `collateralAmount` of `feePayerData.collateralCurrency`.
   * @param collateralAmount total amount of collateral tokens to be sent to the sponsor's position.
   */
  function deposit(FixedPoint.Unsigned memory collateralAmount) external;

  /**
   * @notice Transfers `collateralAmount` of `feePayerData.collateralCurrency` from the sponsor's position to the sponsor.
   * @dev Reverts if the withdrawal puts this position's collateralization ratio below the global collateralization
   * ratio. In that case, use `requestWithdrawal`. Might not withdraw the full requested amount to account for precision loss.
   * @param collateralAmount is the amount of collateral to withdraw.
   * @return amountWithdrawn The actual amount of collateral withdrawn.
   */
  function withdraw(FixedPoint.Unsigned memory collateralAmount)
    external
    returns (FixedPoint.Unsigned memory amountWithdrawn);

  /**
   * @notice Starts a withdrawal request that, if passed, allows the sponsor to withdraw` from their position.
   * @dev The request will be pending for `withdrawalLiveness`, during which the position can be liquidated.
   * @param collateralAmount the amount of collateral requested to withdraw
   */
  function requestWithdrawal(FixedPoint.Unsigned memory collateralAmount)
    external;

  /**
   * @notice After a passed withdrawal request (i.e., by a call to `requestWithdrawal` and waiting
   * `withdrawalLiveness`), withdraws `positionData.withdrawalRequestAmount` of collateral currency.
   * @dev Might not withdraw the full requested amount in order to account for precision loss or if the full requested
   * amount exceeds the collateral in the position (due to paying fees).
   * @return amountWithdrawn The actual amount of collateral withdrawn.
   */
  function withdrawPassedRequest()
    external
    returns (FixedPoint.Unsigned memory amountWithdrawn);

  /**
   * @notice Cancels a pending withdrawal request.
   */
  function cancelWithdrawal() external;

  /**
   * @notice Creates tokens by creating a new position or by augmenting an existing position. Pulls `collateralAmount
   * ` into the sponsor's position and mints `numTokens` of `tokenCurrency`.
   * @dev This contract must have the Minter role for the `tokenCurrency`.
   * @dev Reverts if minting these tokens would put the position's collateralization ratio below the
   * global collateralization ratio. This contract must be approved to spend at least `collateralAmount` of
   * `feePayerData.collateralCurrency`.
   * @param collateralAmount is the number of collateral tokens to collateralize the position with
   * @param numTokens is the number of tokens to mint from the position.
   */
  function create(
    FixedPoint.Unsigned memory collateralAmount,
    FixedPoint.Unsigned memory numTokens
  ) external;

  /**
   * @notice Burns `numTokens` of `tokenCurrency` and sends back the proportional amount of `feePayerData.collateralCurrency`.
   * @dev Can only be called by a token sponsor. Might not redeem the full proportional amount of collateral
   * in order to account for precision loss. This contract must be approved to spend at least `numTokens` of
   * `tokenCurrency`.
   * @dev This contract must have the Burner role for the `tokenCurrency`.
   * @param numTokens is the number of tokens to be burnt for a commensurate amount of collateral.
   * @return amountWithdrawn The actual amount of collateral withdrawn.
   */
  function redeem(FixedPoint.Unsigned memory numTokens)
    external
    returns (FixedPoint.Unsigned memory amountWithdrawn);

  /**
   * @notice Burns `numTokens` of `tokenCurrency` to decrease sponsors position size, without sending back `feePayerData.collateralCurrency`.
   * This is done by a sponsor to increase position CR. Resulting size is bounded by minSponsorTokens.
   * @dev Can only be called by token sponsor. This contract must be approved to spend `numTokens` of `tokenCurrency`.
   * @dev This contract must have the Burner role for the `tokenCurrency`.
   * @param numTokens is the number of tokens to be burnt for a commensurate amount of collateral.
   */
  function repay(FixedPoint.Unsigned memory numTokens) external;

  /**
   * @notice If the contract is emergency shutdown then all token holders and sponsors can redeem their tokens or
   * remaining collateral for the underlying asset at the prevailing price defined by a DVM vote.
   * @dev This burns all tokens from the caller of `tokenCurrency` and sends back the resolved settlement value of
   * `feePayerData.collateralCurrency`. Might not redeem the full proportional amount of collateral in order to account for
   * precision loss. This contract must be approved to spend `tokenCurrency` at least up to the caller's full balance.
   * @dev This contract must have the Burner role for the `tokenCurrency`.
   * @dev Note that this function does not call the updateFundingRate modifier to update the funding rate as this
   * function is only called after an emergency shutdown & there should be no funding rate updates after the shutdown.
   * @return amountWithdrawn The actual amount of collateral withdrawn.
   */
  function settleEmergencyShutdown()
    external
    returns (FixedPoint.Unsigned memory amountWithdrawn);

  /****************************************
   *        GLOBAL STATE FUNCTIONS        *
   ****************************************/

  /**
   * @notice Premature contract settlement under emergency circumstances.
   * @dev Only the governor can call this function as they are permissioned within the `FinancialContractAdmin`.
   * Upon emergency shutdown, the contract settlement time is set to the shutdown time. This enables withdrawal
   * to occur via the `settleEmergencyShutdown` function.
   */
  function emergencyShutdown() external;

  /**
   * @notice Theoretically supposed to pay fees and move money between margin accounts to make sure they
   * reflect the NAV of the contract. However, this functionality doesn't apply to this contract.
   * @dev This is supposed to be implemented by any contract that inherits `AdministrateeInterface` and callable
   * only by the Governor contract. This method is therefore minimally implemented in this contract and does nothing.
   */
  function remargin() external;

  /**
   * @notice Drains any excess balance of the provided ERC20 token to a pre-selected beneficiary.
   * @dev This will drain down to the amount of tracked collateral and drain the full balance of any other token.
   * @param token address of the ERC20 token whose excess balance should be drained.
   */
  function trimExcess(IERC20 token)
    external
    returns (FixedPoint.Unsigned memory amount);

  /**
   * @notice Add TokenSponsor to POOL_ROLE
   * @param pool address of the TokenSponsor pool.
   */
  function addPool(address pool) external;

  /**
   * @notice Add admin to DEFAULT_ADMIN_ROLE
   * @param admin address of the Admin.
   */
  function addAdmin(address admin) external;

  /**
   * @notice TokenSponsor pool renounce to POOL_ROLE
   */
  function renouncePool() external;

  /**
   * @notice Admin and TokenSponsor pool renounce to DEFAULT_ADMIN_ROLE and POOL_ROLE
   */
  function renounceAdminAndPool() external;

  /**
   * @notice Add derivative as minter of synthetic token
   * @param derivative address of the derivative
   */
  function addSyntheticTokenMinter(address derivative) external;

  /**
   * @notice Add derivative as burner of synthetic token
   * @param derivative address of the derivative
   */
  function addSyntheticTokenBurner(address derivative) external;

  /**
   * @notice Add derivative as admin of synthetic token
   * @param derivative address of the derivative
   */
  function addSyntheticTokenAdmin(address derivative) external;

  /**
   * @notice Add derivative as admin, minter and burner of synthetic token
   * @param derivative address of the derivative
   */
  function addSyntheticTokenAdminAndMinterAndBurner(address derivative)
    external;

  /**
   * @notice This contract renounce to be minter of synthetic token
   */
  function renounceSyntheticTokenMinter() external;

  /**
   * @notice This contract renounce to be burner of synthetic token
   */
  function renounceSyntheticTokenBurner() external;

  /**
   * @notice This contract renounce to be admin of synthetic token
   */
  function renounceSyntheticTokenAdmin() external;

  /**
   * @notice This contract renounce to be admin, minter and burner of synthetic token
   */
  function renounceSyntheticTokenAdminAndMinterAndBurner() external;

  /**
   * @notice Accessor method for a sponsor's collateral.
   * @dev This is necessary because the struct returned by the positions() method shows
   * rawCollateral, which isn't a user-readable value.
   * @param sponsor address whose collateral amount is retrieved.
   * @return collateralAmount Amount of collateral within a sponsors position.
   */
  function getCollateral(address sponsor)
    external
    view
    returns (FixedPoint.Unsigned memory collateralAmount);

  /**
   * @notice Accessor method for the total collateral stored within the PerpetualPositionManager.
   * @return totalCollateral Amount of all collateral within the position manager.
   */
  function totalPositionCollateral()
    external
    view
    returns (FixedPoint.Unsigned memory totalCollateral);

  /**
   * @notice Get the price of synthetic token set by DVM after emergencyShutdown call
   * @return emergencyPrice Price of synthetic token
   */
  function emergencyShutdownPrice()
    external
    view
    returns (FixedPoint.Unsigned memory emergencyPrice);
}
