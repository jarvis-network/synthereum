// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import {
  FixedPoint
} from '@jarvis-network/uma-core/contracts/common/implementation/FixedPoint.sol';
import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {
  IDerivative
} from '../../../derivative/common/interfaces/IDerivative.sol';
import {
  ISynthereumDeployer
} from '../../../versioning/interfaces/IDeployer.sol';
import {ISynthereumFinder} from '../../../versioning/interfaces/IFinder.sol';
import {
  ISynthereumPoolDeployment
} from '../../common/interfaces/IPoolDeployment.sol';

/**
 * @title Token Issuer Contract Interface
 */
interface ISynthereumPool is ISynthereumPoolDeployment {
  // Describe fee structure
  struct Fee {
    // Fees charged when a user mints, redeem and exchanges tokens
    FixedPoint.Unsigned feePercentage;
    address[] feeRecipients;
    uint32[] feeProportions;
  }

  //Describe role structure
  struct Roles {
    address admin;
    address maintainer;
    address liquidityProvider;
    address validator;
  }

  struct MintParameters {
    // Sender of the meta-tx
    address sender;
    // Address of the derivative to use for minting
    address derivativeAddr;
    // The amount of collateral supplied
    uint256 collateralAmount;
    // The number of tokens the user wants to mint
    uint256 numTokens;
    // Fee percentage on collateral amount to pay
    uint256 feePercentage;
    // Actual nonce of the user
    uint256 nonce;
    // Timestamp of expiration of the meta-signature
    uint256 expiration;
  }

  struct RedeemParameters {
    // Sender of the meta-tx
    address sender;
    // Address of the derivative to use for redeeming
    address derivativeAddr;
    // The amount of collateral to redeem for tokens
    uint256 collateralAmount;
    // The number of tokens to burn
    uint256 numTokens;
    // Fee percentage on collateral amount to pay
    uint256 feePercentage;
    // Actual nonce of the user
    uint256 nonce;
    // Timestamp of expiration of the meta-signature
    uint256 expiration;
  }

  struct ExchangeParameters {
    // Sender of the meta-tx
    address sender;
    // Address of the derivative to use for redeeming
    address derivativeAddr;
    // Address of the destination pool
    address destPoolAddr;
    // Address of the derivative of the destPool to use for minting
    address destDerivativeAddr;
    // The number of source tokens to swap
    uint256 numTokens;
    // Collateral amount equivalent to numTokens and destNumTokens
    uint256 collateralAmount;
    // The number of destination tokens the swap attempts to procure
    uint256 destNumTokens;
    // Fee percentage on collateral amount to pay
    uint256 feePercentage;
    // Actual nonce of the user
    uint256 nonce;
    // Timestamp of expiration of the meta-signature
    uint256 expiration;
  }

  // Signature
  struct Signature {
    // Recover ID
    uint8 v;
    // First part of the signature
    bytes32 r;
    // Seconda part of the signature
    bytes32 s;
  }

  struct SignatureVerificationParams {
    // security separator accroding to EIP712
    bytes32 domain_separator;
    // typeHash typeHash of struct according to EIP712
    bytes32 typeHash;
    // signature of a validator
    ISynthereumPool.Signature signature;
    // validator role
    bytes32 validator_role;
  }

  enum DerivativeRoles {ADMIN, POOL, ADMIN_AND_POOL}

  enum SynthTokenRoles {ADMIN, MINTER, BURNER, ADMIN_AND_MINTER_AND_BURNER}

  /**
   * @notice Add a derivate to be controlled by this pool
   * @param derivative A perpetual derivative
   */
  function addDerivative(IDerivative derivative) external;

  /**
   * @notice Remove a derivative controlled by this pool
   * @param derivative A perpetual derivative
   */
  function removeDerivative(IDerivative derivative) external;

  /**
   * @notice Mint tokens using collateral
   * @notice This requires the meta-signature of a validator
   * @notice User must approve collateral transfer for the mint request to succeed
   * @param mintMetaTx Meta-tx containing mint parameters
   * @param signature Validator signature
   * @return feePaid Amount of collateral paid by minter as fee
   */
  function mint(MintParameters memory mintMetaTx, Signature memory signature)
    external
    returns (uint256 feePaid);

  /**
   * @notice Submit a request to redeem collateral
   * @notice This requires the meta-signature of a validator
   * @notice User must approve synthetic token transfer for the redeem request to succeed
   * @param redeemMetaTx Meta-tx containing redeem parameters
   * @param signature Validator signature
   * @return feePaid Amount of collateral paid by user as fee
   */
  function redeem(
    RedeemParameters memory redeemMetaTx,
    Signature memory signature
  ) external returns (uint256 feePaid);

  /**
   * @notice Submit a request to exchange synthetic tokens for other synthetic tokens
   * @notice This requires the meta-signature of a validator
   * @notice User must approve synthetic token transfer for the exchange request to succeed
   * @param exchangeMetaTx Meta-tx containing exchange parameters
   * @param signature Validator signature
   * @return feePaid Amount of collateral paid by user as fee
   */
  function exchange(
    ExchangeParameters memory exchangeMetaTx,
    Signature memory signature
  ) external returns (uint256 feePaid);

  /**
   * @notice Called by a source TIC's `exchange` function to mint destination tokens
   * @notice This functon can be called only by a pool registred in the PoolRegister contract
   * @param srcDerivative Derivative used by the source pool
   * @param derivative The derivative of the destination pool to use for mint
   * @param collateralAmount The amount of collateral to use from the source TIC
   * @param numTokens The number of new tokens to mint
   */
  function exchangeMint(
    IDerivative srcDerivative,
    IDerivative derivative,
    uint256 collateralAmount,
    uint256 numTokens
  ) external;

  /**
   * @notice Liquidity provider withdraw margin from the pool
   * @param collateralAmount The amount of margin to withdraw
   */
  function withdrawFromPool(uint256 collateralAmount) external;

  /**
   * @notice Move collateral from TIC to its derivative in order to increase GCR
   * @param derivative Derivative on which to deposit collateral
   * @param collateralAmount The amount of collateral to move into derivative
   */
  function depositIntoDerivative(
    IDerivative derivative,
    uint256 collateralAmount
  ) external;

  /**
   * @notice Start a slow withdrawal request
   * @notice Collateral can be withdrawn once the liveness period has elapsed
   * @param derivative Derivative from which collateral withdrawal is requested
   * @param collateralAmount The amount of excess collateral to withdraw
   */
  function slowWithdrawRequest(IDerivative derivative, uint256 collateralAmount)
    external;

  /**
   * @notice Withdraw collateral after a withdraw request has passed it's liveness period
   * @param derivative Derivative from which collateral withdrawal is requested
   * @return amountWithdrawn Amount of collateral withdrawn by slow withdrawal
   */
  function slowWithdrawPassedRequest(IDerivative derivative)
    external
    returns (uint256 amountWithdrawn);

  /**
   * @notice Withdraw collateral immediately if the remaining collateral is above GCR
   * @param derivative Derivative from which fast withdrawal is requested
   * @param collateralAmount The amount of excess collateral to withdraw
   * @return amountWithdrawn Amount of collateral withdrawn by fast withdrawal
   */
  function fastWithdraw(IDerivative derivative, uint256 collateralAmount)
    external
    returns (uint256 amountWithdrawn);

  /**
   * @notice Activate emergency shutdown on a derivative in order to liquidate the token holders in case of emergency
   * @param derivative Derivative on which the emergency shutdown is called
   */
  function emergencyShutdown(IDerivative derivative) external;

  /**
   * @notice Redeem tokens after contract emergency shutdown
   * @param derivative Derivative for which settlement is requested
   * @return amountSettled Amount of collateral withdrawn after emergency shutdown
   */
  function settleEmergencyShutdown(IDerivative derivative)
    external
    returns (uint256 amountSettled);

  /**
   * @notice Update the fee percentage, recipients and recipient proportions
   * @param _fee Fee struct containing percentage, recipients and proportions
   */
  function setFee(Fee memory _fee) external;

  /**
   * @notice Update the fee percentage
   * @param _feePercentage The new fee percentage
   */
  function setFeePercentage(uint256 _feePercentage) external;

  /**
   * @notice Update the addresses of recipients for generated fees and proportions of fees each address will receive
   * @param _feeRecipients An array of the addresses of recipients that will receive generated fees
   * @param _feeProportions An array of the proportions of fees generated each recipient will receive
   */
  function setFeeRecipients(
    address[] memory _feeRecipients,
    uint32[] memory _feeProportions
  ) external;

  /**
   * @notice Reset the starting collateral ratio - for example when you add a new derivative without collateral
   * @param startingCollateralRatio Initial ratio between collateral amount and synth tokens
   */
  function setStartingCollateralization(uint256 startingCollateralRatio)
    external;

  /**
   * @notice Add a role into derivative to another contract
   * @param derivative Derivative in which a role is added
   * @param derivativeRole Role to add
   * @param addressToAdd address of EOA or smart contract to add with a role in derivative
   */
  function addRoleInDerivative(
    IDerivative derivative,
    DerivativeRoles derivativeRole,
    address addressToAdd
  ) external;

  /**
   * @notice This pool renounce a role in the derivative
   * @param derivative Derivative in which a role is renounced
   * @param derivativeRole Role to renounce
   */
  function renounceRoleInDerivative(
    IDerivative derivative,
    DerivativeRoles derivativeRole
  ) external;

  /**
   * @notice Add a role into synthetic token to another contract
   * @param derivative Derivative in which a role is added
   * @param synthTokenRole Role to add
   * @param addressToAdd address of EOA or smart contract to add with a role in derivative
   */
  function addRoleInSynthToken(
    IDerivative derivative,
    SynthTokenRoles synthTokenRole,
    address addressToAdd
  ) external;

  /**
   * @notice A derivative renounces a role into synthetic token
   * @param derivative Derivative in which a role is renounced
   * @param synthTokenRole Role to renounce
   */
  function renounceRoleInSynthToken(
    IDerivative derivative,
    SynthTokenRoles synthTokenRole
  ) external;

  /**
   * @notice Set the possibility to accept only EOA meta-tx
   * @param isContractAllowed Flag that represent options to receive tx by a contract or only EOA
   */
  function setIsContractAllowed(bool isContractAllowed) external;

  /**
   * @notice Get all the derivatives associated to this pool
   * @return Return list of all derivatives
   */
  function getAllDerivatives() external view returns (IDerivative[] memory);

  /**
   * @notice Check if a derivative is in the whitelist of this pool
   * @param derivative Perpetual derivative
   * @return isAdmitted Return true if in the whitelist, otherwise false
   */
  function isDerivativeAdmitted(IDerivative derivative)
    external
    view
    returns (bool isAdmitted);

  /**
   * @notice Get the starting collateral ratio of the pool
   * @return startingCollateralRatio Initial ratio between collateral amount and synth tokens
   */
  function getStartingCollateralization()
    external
    view
    returns (uint256 startingCollateralRatio);

  /**
   * @notice Returns if pool can accept only EOA meta-tx or also contract meta-tx
   * @return isAllowed True if accept also contract, false if only EOA
   */
  function isContractAllowed() external view returns (bool isAllowed);

  /**
   * @notice Returns infos about fee set
   * @return fee Percentage and recipients of fee
   */
  function getFeeInfo() external view returns (Fee memory fee);

  /**
   * @notice Returns nonce of user meta-signature
   * @return nonce Nonce of user
   */
  function getUserNonce(address user) external view returns (uint256 nonce);

  /**
   * @notice Calculate the fees a user will have to pay to mint tokens with their collateral
   * @param collateralAmount Amount of collateral on which fees are calculated
   * @return fee Amount of fee that must be paid by the user
   */
  function calculateFee(uint256 collateralAmount)
    external
    view
    returns (uint256 fee);
}
