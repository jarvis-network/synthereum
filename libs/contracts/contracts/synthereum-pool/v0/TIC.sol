pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import {AccessControl} from '@openzeppelin/contracts/access/AccessControl.sol';
import {SynthereumTICInterface} from './interfaces/ITIC.sol';
import '@openzeppelin/contracts/utils/ReentrancyGuard.sol';
import {SafeMath} from '@openzeppelin/contracts/math/SafeMath.sol';
import {
  FixedPoint
} from '@jarvis-network/uma-core/contracts/common/implementation/FixedPoint.sol';
import {HitchensUnorderedKeySetLib} from './HitchensUnorderedKeySet.sol';
import {SynthereumTICHelper} from './TICHelper.sol';
import {ERC20} from '@openzeppelin/contracts/token/ERC20/ERC20.sol';
import {IStandardERC20} from '../../base/interfaces/IStandardERC20.sol';

import {IDerivative} from '../../derivative/common/interfaces/IDerivative.sol';

/**
 * @title Token Issuer Contract
 * @notice Collects margin, issues synthetic assets, and distributes accrued interest
 * @dev Collateral is wrapped by an `RToken` to accrue and distribute interest before being sent
 *      to the `ExpiringMultiParty` contract.
 */
contract SynthereumTIC is
  AccessControl,
  SynthereumTICInterface,
  ReentrancyGuard
{
  //----------------------------------------
  // Constants
  //----------------------------------------

  bytes32 public constant MAINTAINER_ROLE = keccak256('Maintainer');

  bytes32 public constant LIQUIDITY_PROVIDER_ROLE =
    keccak256('Liquidity Provider');

  bytes32 public constant VALIDATOR_ROLE = keccak256('Validator');

  //----------------------------------------
  // Type definitions
  //----------------------------------------

  using SafeMath for uint256;
  using FixedPoint for FixedPoint.Unsigned;
  using HitchensUnorderedKeySetLib for HitchensUnorderedKeySetLib.Set;
  using SynthereumTICHelper for Storage;

  struct Storage {
    uint8 version;
    IDerivative derivative;
    FixedPoint.Unsigned startingCollateralization;
    address liquidityProvider;
    address validator;
    ERC20 collateralToken;
    Fee fee;
    // Used with individual proportions to scale values
    uint256 totalFeeProportions;
    mapping(bytes32 => MintRequest) mintRequests;
    HitchensUnorderedKeySetLib.Set mintRequestSet;
    mapping(bytes32 => ExchangeRequest) exchangeRequests;
    HitchensUnorderedKeySetLib.Set exchangeRequestSet;
    mapping(bytes32 => RedeemRequest) redeemRequests;
    HitchensUnorderedKeySetLib.Set redeemRequestSet;
  }

  event MintRequested(
    bytes32 mintID,
    uint256 timestamp,
    address indexed sender,
    uint256 collateralAmount,
    uint256 numTokens
  );
  event MintApproved(bytes32 mintID, address indexed sender);
  event MintRejected(bytes32 mintID, address indexed sender);

  event ExchangeRequested(
    bytes32 exchangeID,
    uint256 timestamp,
    address indexed sender,
    address destTIC,
    uint256 numTokens,
    uint256 destNumTokens
  );
  event ExchangeApproved(bytes32 exchangeID, address indexed sender);
  event ExchangeRejected(bytes32 exchangeID, address indexed sender);

  event RedeemRequested(
    bytes32 redeemID,
    uint256 timestamp,
    address indexed sender,
    uint256 collateralAmount,
    uint256 numTokens
  );
  event RedeemApproved(bytes32 redeemID, address indexed sender);
  event RedeemRejected(bytes32 redeemID, address indexed sender);
  event SetFeePercentage(uint256 feePercentage);
  event SetFeeRecipients(address[] feeRecipients, uint32[] feeProportions);

  //----------------------------------------
  // State variables
  //----------------------------------------

  Storage private ticStorage;

  //----------------------------------------
  // Constructor
  //----------------------------------------

  /**
   * @notice The derivative's margin currency must be a RToken
   * @notice The validator will generally be an address owned by the LP
   * @notice `_startingCollateralization should be greater than the expected asset price multiplied
   *      by the collateral requirement. The degree to which it is greater should be based on
   *      the expected asset volatility.
   * @param _derivative The `ExpiringMultiParty`
   * @param _version Synthereum version
   * @param _roles The addresses of admin, maintainer, liquidity provider and validator
   * @param _startingCollateralization Collateralization ratio to use before a global one is set
   * @param _fee The fee structure
   */
  constructor(
    IDerivative _derivative,
    uint8 _version,
    Roles memory _roles,
    uint256 _startingCollateralization,
    Fee memory _fee
  ) public nonReentrant {
    _setRoleAdmin(DEFAULT_ADMIN_ROLE, DEFAULT_ADMIN_ROLE);
    _setRoleAdmin(MAINTAINER_ROLE, DEFAULT_ADMIN_ROLE);
    _setRoleAdmin(LIQUIDITY_PROVIDER_ROLE, DEFAULT_ADMIN_ROLE);
    _setRoleAdmin(VALIDATOR_ROLE, DEFAULT_ADMIN_ROLE);
    _setupRole(DEFAULT_ADMIN_ROLE, _roles.admin);
    _setupRole(MAINTAINER_ROLE, _roles.maintainer);
    _setupRole(LIQUIDITY_PROVIDER_ROLE, _roles.liquidityProvider);
    _setupRole(VALIDATOR_ROLE, _roles.validator);
    ticStorage.initialize(
      _derivative,
      _version,
      _roles.liquidityProvider,
      _roles.validator,
      FixedPoint.Unsigned(_startingCollateralization)
    );
    _setFeePercentage(_fee.feePercentage.rawValue);
    _setFeeRecipients(_fee.feeRecipients, _fee.feeProportions);
  }

  //----------------------------------------
  // Modifiers
  //----------------------------------------

  modifier onlyMaintainer() {
    require(
      hasRole(MAINTAINER_ROLE, msg.sender),
      'Sender must be the maintainer'
    );
    _;
  }

  modifier onlyLiquidityProvider() {
    require(
      hasRole(LIQUIDITY_PROVIDER_ROLE, msg.sender),
      'Sender must be the liquidity provider'
    );
    _;
  }

  modifier onlyValidator() {
    require(
      hasRole(VALIDATOR_ROLE, msg.sender),
      'Sender must be the validator'
    );
    _;
  }

  //----------------------------------------
  // External functions
  //----------------------------------------

  /**
   * @notice Submit a request to mint tokens
   * @notice The request needs to approved by the LP before tokens are created. This is
   *         necessary to prevent users from abusing LPs by minting large amounts of tokens
   *         with little collateral.
   * @notice User must approve collateral transfer for the mint request to succeed
   * @param collateralAmount The amount of collateral supplied
   * @param numTokens The number of tokens the user wants to mint
   */
  function mintRequest(uint256 collateralAmount, uint256 numTokens)
    external
    override
    nonReentrant
  {
    bytes32 mintID =
      ticStorage.mintRequest(
        FixedPoint.Unsigned(collateralAmount),
        FixedPoint.Unsigned(numTokens)
      );

    emit MintRequested(mintID, now, msg.sender, collateralAmount, numTokens);
  }

  /**
   * @notice Approve a mint request as an LP
   * @notice This will typically be done with a keeper bot
   * @notice User needs to have approved the transfer of collateral tokens
   * @param mintID The ID of the mint request
   */
  function approveMint(bytes32 mintID)
    external
    override
    nonReentrant
    onlyValidator
  {
    address sender = ticStorage.mintRequests[mintID].sender;

    ticStorage.approveMint(mintID);

    emit MintApproved(mintID, sender);
  }

  /**
   * @notice Reject a mint request as an LP
   * @notice This will typically be done with a keeper bot
   * @param mintID The ID of the mint request
   */
  function rejectMint(bytes32 mintID)
    external
    override
    nonReentrant
    onlyValidator
  {
    address sender = ticStorage.mintRequests[mintID].sender;

    ticStorage.rejectMint(mintID);

    emit MintRejected(mintID, sender);
  }

  /**
   * @notice Liquidity provider supplies margin to the TIC to collateralize user deposits
   * @param collateralAmount The amount of margin supplied
   */
  function deposit(uint256 collateralAmount)
    external
    override
    nonReentrant
    onlyLiquidityProvider
  {
    ticStorage.deposit(FixedPoint.Unsigned(collateralAmount));
  }

  /**
   * @notice Liquidity provider withdraw margin from the TIC
   * @param collateralAmount The amount of margin to withdraw
   */
  function withdraw(uint256 collateralAmount)
    external
    override
    nonReentrant
    onlyLiquidityProvider
  {
    ticStorage.withdraw(FixedPoint.Unsigned(collateralAmount));
  }

  /**
   * TODO: Potentially restrict this function to only TICs registered on a whitelist
   * @notice Called by a source TIC's `exchange` function to mint destination tokens
   * @dev This function could be called by any account to mint tokens, however they will lose
   *      their excess collateral to the liquidity provider when they redeem the tokens.
   * @param collateralAmount The amount of collateral to use from the source TIC
   * @param numTokens The number of new tokens to mint
   */
  function exchangeMint(uint256 collateralAmount, uint256 numTokens)
    external
    override
    nonReentrant
  {
    ticStorage.exchangeMint(
      FixedPoint.Unsigned(collateralAmount),
      FixedPoint.Unsigned(numTokens)
    );
  }

  /**
   * @notice Move collateral from TIC to its derivative in order to increase GCR
   * @param collateralAmount The amount of collateral to move into derivative
   */
  function depositIntoDerivative(uint256 collateralAmount)
    external
    override
    nonReentrant
    onlyLiquidityProvider
  {
    ticStorage.depositIntoDerivative(FixedPoint.Unsigned(collateralAmount));
  }

  /**
   * @notice Start a withdrawal request
   * @notice Collateral can be withdrawn once the liveness period has elapsed
   * @param collateralAmount The amount of short margin to withdraw
   */
  function withdrawRequest(uint256 collateralAmount)
    external
    override
    onlyLiquidityProvider
    nonReentrant
  {
    ticStorage.withdrawRequest(FixedPoint.Unsigned(collateralAmount));
  }

  /**
   * @notice Withdraw collateral after a withdraw request has passed it's liveness period
   */
  function withdrawPassedRequest()
    external
    override
    onlyLiquidityProvider
    nonReentrant
  {
    ticStorage.withdrawPassedRequest();
  }

  /**
   * @notice Submit a request to redeem tokens
   * @notice The request needs to approved by the LP before tokens are created. This is
   *         necessary to prevent users from abusing LPs by redeeming large amounts of collateral
   *         from a small number of tokens.
   * @notice User must approve synthetic token transfer for the redeem request to succeed
   * @param collateralAmount The amount of collateral to redeem tokens for
   * @param numTokens The number of tokens to redeem
   */
  function redeemRequest(uint256 collateralAmount, uint256 numTokens)
    external
    override
    nonReentrant
  {
    bytes32 redeemID =
      ticStorage.redeemRequest(
        FixedPoint.Unsigned(collateralAmount),
        FixedPoint.Unsigned(numTokens)
      );

    emit RedeemRequested(
      redeemID,
      now,
      msg.sender,
      collateralAmount,
      numTokens
    );
  }

  /**
   * @notice Approve a redeem request as an LP
   * @notice This will typically be done with a keeper bot
   * @notice User needs to have approved the transfer of synthetic tokens
   * @param redeemID The ID of the redeem request
   */
  function approveRedeem(bytes32 redeemID)
    external
    override
    nonReentrant
    onlyValidator
  {
    address sender = ticStorage.redeemRequests[redeemID].sender;

    ticStorage.approveRedeem(redeemID);

    emit RedeemApproved(redeemID, sender);
  }

  /**
   * @notice Reject a redeem request as an LP
   * @notice This will typically be done with a keeper bot
   * @param redeemID The ID of the redeem request
   */
  function rejectRedeem(bytes32 redeemID)
    external
    override
    nonReentrant
    onlyValidator
  {
    address sender = ticStorage.redeemRequests[redeemID].sender;

    ticStorage.rejectRedeem(redeemID);

    emit RedeemRejected(redeemID, sender);
  }

  /**
   * @notice Activate emergency shutdown on a derivative in order to liquidate the token holders in case of emergency
   */
  function emergencyShutdown() external override onlyMaintainer nonReentrant {
    ticStorage.emergencyShutdown();
  }

  /**
   * @notice Redeem tokens after contract emergency shutdown
   * @notice After derivative shutdown, an LP should use this instead of `withdrawRequest` to
   *         retrieve their collateral.
   */
  function settleEmergencyShutdown() external override nonReentrant {
    ticStorage.settleEmergencyShutdown();
  }

  /**
   * @notice Submit a request to perform an atomic of tokens between TICs
   * @dev The number of destination tokens needs to be calculated relative to the value of the
   *      source tokens and the destination's collateral ratio. If too many destination tokens
   *      are requested the transaction will fail.
   * @param destTIC The destination TIC
   * @param numTokens The number of source tokens to swap
   * @param collateralAmount Collateral amount equivalent to numTokens and destNumTokens
   * @param destNumTokens The number of destination tokens the swap attempts to procure
   */
  function exchangeRequest(
    SynthereumTICInterface destTIC,
    uint256 numTokens,
    uint256 collateralAmount,
    uint256 destNumTokens
  ) external override nonReentrant {
    bytes32 exchangeID =
      ticStorage.exchangeRequest(
        destTIC,
        FixedPoint.Unsigned(numTokens),
        FixedPoint.Unsigned(collateralAmount),
        FixedPoint.Unsigned(destNumTokens)
      );

    emit ExchangeRequested(
      exchangeID,
      now,
      msg.sender,
      address(destTIC),
      numTokens,
      destNumTokens
    );
  }

  /**
   * @notice Approve an exchange request
   * @notice This will typically be done with a keeper bot
   * @notice User needs to have approved the transfer of synthetic tokens
   * @param exchangeID The ID of the exchange request
   */
  function approveExchange(bytes32 exchangeID)
    external
    override
    onlyValidator
    nonReentrant
  {
    address sender = ticStorage.exchangeRequests[exchangeID].sender;

    ticStorage.approveExchange(exchangeID);

    emit ExchangeApproved(exchangeID, sender);
  }

  /**
   * @notice Reject an exchange request
   * @notice This will typically be done with a keeper bot
   * @param exchangeID The ID of the exchange request
   */
  function rejectExchange(bytes32 exchangeID)
    external
    override
    onlyValidator
    nonReentrant
  {
    address sender = ticStorage.exchangeRequests[exchangeID].sender;

    ticStorage.rejectExchange(exchangeID);

    emit ExchangeRejected(exchangeID, sender);
  }

  //----------------------------------------
  // External views
  //----------------------------------------

  /**
   * @notice Get Synthereum version
   * @return poolVersion Returns the version of this Synthereum pool
   */
  function version() external view returns (uint8 poolVersion) {
    poolVersion = ticStorage.version;
  }

  /**
   * @notice Get the derivative contract
   * @return The `ExpiringMultiParty` derivative contract
   */
  function derivative() external view override returns (IDerivative) {
    return ticStorage.derivative;
  }

  /**
   * @notice Get the collateral token
   * @return The ERC20 collateral token
   */
  function collateralToken() external view override returns (ERC20) {
    return ticStorage.collateralToken;
  }

  /**
   * @notice Get the synthetic token from the derivative contract
   * @return The ERC20 synthetic token
   */
  function syntheticToken() external view override returns (ERC20) {
    return ERC20(address(ticStorage.derivative.tokenCurrency()));
  }

  /**
   * @notice Get the synthetic token symbol associated to this pool
   * @return symbol The ERC20 synthetic token symbol
   */
  function syntheticTokenSymbol() external view returns (string memory symbol) {
    symbol = IStandardERC20(address(ticStorage.derivative.tokenCurrency()))
      .symbol();
  }

  /**
   * @notice Calculate the fees a user will have to pay to mint tokens with their collateral
   * @return The fee structure
   */
  function calculateFee(uint256 collateralAmount)
    external
    view
    override
    returns (uint256)
  {
    return
      FixedPoint
        .Unsigned(collateralAmount)
        .mul(ticStorage.fee.feePercentage)
        .rawValue;
  }

  /**
   * @notice Get all open mint requests
   * @return An array of mint requests
   */
  function getMintRequests()
    external
    view
    override
    returns (MintRequest[] memory)
  {
    return ticStorage.getMintRequests();
  }

  /**
   * @notice Get all open redeem requests
   * @return An array of redeem requests
   */
  function getRedeemRequests()
    external
    view
    override
    returns (RedeemRequest[] memory)
  {
    return ticStorage.getRedeemRequests();
  }

  /**
   * @notice Get all open exchange requests
   * @return An array of exchange requests
   */
  function getExchangeRequests()
    external
    view
    override
    returns (ExchangeRequest[] memory)
  {
    return ticStorage.getExchangeRequests();
  }

  //----------------------------------------
  // Public functions
  //----------------------------------------

  /**
   * @notice Update the fee percentage, recipients and recipient proportions
   * @param _fee Fee struct containing percentage, recipients and proportions
   */
  function setFee(Fee memory _fee)
    external
    override
    nonReentrant
    onlyMaintainer
  {
    _setFeePercentage(_fee.feePercentage.rawValue);
    _setFeeRecipients(_fee.feeRecipients, _fee.feeProportions);
  }

  /**
   * @notice Update the fee percentage
   * @param _feePercentage The new fee percentage
   */
  function setFeePercentage(uint256 _feePercentage)
    external
    override
    nonReentrant
    onlyMaintainer
  {
    _setFeePercentage(_feePercentage);
  }

  /**
   * @notice Update the percentage of the fee
   * @param _feeRecipients The percentage of new fee
   * @param _feeProportions The percentage of new fee
   */
  function setFeeRecipients(
    address[] memory _feeRecipients,
    uint32[] memory _feeProportions
  ) external override nonReentrant onlyMaintainer {
    _setFeeRecipients(_feeRecipients, _feeProportions);
  }

  //----------------------------------------
  // Private functions
  //----------------------------------------

  /**
   * @notice Update the recipients and their proportions
   * @param _feePercentage The percentage of new fee
   */
  function _setFeePercentage(uint256 _feePercentage) private {
    ticStorage.setFeePercentage(FixedPoint.Unsigned(_feePercentage));
    emit SetFeePercentage(_feePercentage);
  }

  /**
   * @notice Update the fee recipients and recipient proportions
   * @param _feeRecipients Array of the new fee recipients
   * @param _feeProportions Array of the new fee recipient proportions
   */
  function _setFeeRecipients(
    address[] memory _feeRecipients,
    uint32[] memory _feeProportions
  ) private {
    ticStorage.setFeeRecipients(_feeRecipients, _feeProportions);
    emit SetFeeRecipients(_feeRecipients, _feeProportions);
  }
}
