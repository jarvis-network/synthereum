// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {IStandardERC20} from '../../base/interfaces/IStandardERC20.sol';
import {IDerivative} from '../../derivative/common/interfaces/IDerivative.sol';
import {ISynthereumPool} from './interfaces/IPool.sol';
import {ISynthereumPoolStorage} from './interfaces/IPoolStorage.sol';
import {ISynthereumFinder} from '../../versioning/interfaces/IFinder.sol';
import {ISynthereumDeployer} from '../../versioning/interfaces/IDeployer.sol';
import {SynthereumInterfaces} from '../../versioning/Constants.sol';
import {Strings} from '@openzeppelin/contracts/utils/Strings.sol';
import {EnumerableSet} from '@openzeppelin/contracts/utils/EnumerableSet.sol';
import {
  FixedPoint
} from '@jarvis-network/uma-core/contracts/common/implementation/FixedPoint.sol';
import {SynthereumPoolLib} from './PoolLib.sol';
import {
  Lockable
} from '@jarvis-network/uma-core/contracts/common/implementation/Lockable.sol';
import {AccessControl} from '@openzeppelin/contracts/access/AccessControl.sol';

/**
 * @title Token Issuer Contract
 * @notice Collects collateral and issues synthetic assets
 */
contract SynthereumPool is
  AccessControl,
  ISynthereumPoolStorage,
  ISynthereumPool,
  Lockable
{
  using FixedPoint for FixedPoint.Unsigned;
  using SynthereumPoolLib for Storage;
  //----------------------------------------
  // Constants
  //----------------------------------------

  bytes32 public constant MAINTAINER_ROLE = keccak256('Maintainer');

  bytes32 public constant LIQUIDITY_PROVIDER_ROLE =
    keccak256('Liquidity Provider');

  bytes32 public constant VALIDATOR_ROLE = keccak256('Validator');

  //Type hashes for meta-signatures
  bytes32 public immutable MINT_TYPEHASH;

  bytes32 public immutable REDEEM_TYPEHASH;

  bytes32 public immutable EXCHANGE_TYPEHASH;

  //Domain separator according to EIP712
  bytes32 public DOMAIN_SEPARATOR;

  //----------------------------------------
  // State variables
  //----------------------------------------

  Storage private poolStorage;

  //----------------------------------------
  // Events
  //----------------------------------------

  event Mint(
    address indexed account,
    address indexed pool,
    uint256 collateralSent,
    uint256 numTokensReceived,
    uint256 feePaid
  );

  event Redeem(
    address indexed account,
    address indexed pool,
    uint256 numTokensSent,
    uint256 collateralReceived,
    uint256 feePaid
  );

  event Exchange(
    address indexed account,
    address indexed sourcePool,
    address indexed destPool,
    uint256 numTokensSent,
    uint256 destNumTokensReceived,
    uint256 feePaid
  );

  event Settlement(
    address indexed account,
    address indexed pool,
    uint256 numTokens,
    uint256 collateralSettled
  );

  event SetFeePercentage(uint256 feePercentage);
  event SetFeeRecipients(address[] feeRecipients, uint32[] feeProportions);
  // We may omit the pool from event since we can recover it from the address of smart contract emitting event, but for query convenience we include it in the event
  event AddDerivative(address indexed pool, address indexed derivative);
  event RemoveDerivative(address indexed pool, address indexed derivative);

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

  //----------------------------------------
  // Constructor
  //----------------------------------------

  /**
   * @notice The derivative's collateral currency must be an ERC20
   * @notice The validator will generally be an address owned by the LP
   * @notice `_startingCollateralization should be greater than the expected asset price multiplied
   *      by the collateral requirement. The degree to which it is greater should be based on
   *      the expected asset volatility.
   * @param _derivative The perpetual derivative
   * @param _finder The Synthereum finder
   * @param _version Synthereum version
   * @param _roles The addresses of admin, maintainer, liquidity provider and validator
   * @param _isContractAllowed Enable or disable the option to accept meta-tx only by an EOA for security reason
   * @param _startingCollateralization Collateralization ratio to use before a global one is set
   * @param _fee The fee structure
   */
  constructor(
    IDerivative _derivative,
    ISynthereumFinder _finder,
    uint8 _version,
    Roles memory _roles,
    bool _isContractAllowed,
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
    poolStorage.initialize(
      _version,
      _finder,
      _derivative,
      FixedPoint.Unsigned(_startingCollateralization),
      _isContractAllowed
    );
    poolStorage.setFeePercentage(_fee.feePercentage);
    poolStorage.setFeeRecipients(_fee.feeRecipients, _fee.feeProportions);
    DOMAIN_SEPARATOR = keccak256(
      abi.encode(
        keccak256(
          'EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)'
        ),
        keccak256(bytes('Synthereum Pool')),
        keccak256(bytes(Strings.toString(_version))),
        getChainID(),
        address(this)
      )
    );
    MINT_TYPEHASH = keccak256(
      'MintParameters(address sender,address derivativeAddr,uint256 collateralAmount,uint256 numTokens,uint256 feePercentage,uint256 nonce,uint256 expiration)'
    );
    REDEEM_TYPEHASH = keccak256(
      'RedeemParameters(address sender,address derivativeAddr,uint256 collateralAmount,uint256 numTokens,uint256 feePercentage,uint256 nonce,uint256 expiration)'
    );
    EXCHANGE_TYPEHASH = keccak256(
      'ExchangeParameters(address sender,address derivativeAddr,address destPoolAddr,address destDerivativeAddr,uint256 numTokens,uint256 collateralAmount,uint256 destNumTokens,uint256 feePercentage,uint256 nonce,uint256 expiration)'
    );
  }

  //----------------------------------------
  // External functions
  //----------------------------------------
  /**
   * @notice Add a derivate to be controlled by this pool
   * @param derivative A perpetual derivative
   */
  function addDerivative(IDerivative derivative)
    external
    override
    onlyMaintainer
    nonReentrant
  {
    poolStorage.addDerivative(derivative);
  }

  /**
   * @notice Remove a derivative controlled by this pool
   * @param derivative A perpetual derivative
   */
  function removeDerivative(IDerivative derivative)
    external
    override
    onlyMaintainer
    nonReentrant
  {
    poolStorage.removeDerivative(derivative);
  }

  /**
   * @notice Mint tokens using collateral
   * @notice This requires the meta-signature of a validator
   * @notice User must approve collateral transfer for the mint request to succeed
   * @param mintMetaTx Meta-tx containing mint parameters
   * @param signature Validator signature
   * @return feePaid Amount of collateral paid by the minter as fee
   */
  function mint(MintParameters memory mintMetaTx, Signature memory signature)
    external
    override
    nonReentrant
    returns (uint256 feePaid)
  {
    feePaid = poolStorage.mint(
      mintMetaTx,
      SignatureVerificationParams(
        DOMAIN_SEPARATOR,
        MINT_TYPEHASH,
        signature,
        VALIDATOR_ROLE
      )
    );
  }

  /**
   * @notice Submit a request to redeem tokens
   * @notice This requires the meta-signature of a validator
   * @notice User must approve synthetic token transfer for the redeem request to succeed
   * @param redeemMetaTx Meta-tx containing redeem parameters
   * @param signature Validator signature
   * @return feePaid Amount of collateral paid by user as fee
   */
  function redeem(
    RedeemParameters memory redeemMetaTx,
    Signature memory signature
  ) external override nonReentrant returns (uint256 feePaid) {
    feePaid = poolStorage.redeem(
      redeemMetaTx,
      SignatureVerificationParams(
        DOMAIN_SEPARATOR,
        REDEEM_TYPEHASH,
        signature,
        VALIDATOR_ROLE
      )
    );
  }

  /**
   * @notice Submit a request to exchange tokens for other synthetic tokens
   * @notice This requires the meta-signature of a validator
   * @notice User must approve synthetic token transfer for the exchange request to succeed
   * @param exchangeMetaTx Meta-tx containing exchange parameters
   * @param signature Validator signature
   * @return feePaid Amount of collateral paid by user as fee
   */
  function exchange(
    ExchangeParameters memory exchangeMetaTx,
    Signature memory signature
  ) external override nonReentrant returns (uint256 feePaid) {
    feePaid = poolStorage.exchange(
      exchangeMetaTx,
      SignatureVerificationParams(
        DOMAIN_SEPARATOR,
        EXCHANGE_TYPEHASH,
        signature,
        VALIDATOR_ROLE
      )
    );
  }

  /**
   * @notice Called by a source TIC's `exchange` function to mint destination tokens
   * @notice This functon can be called only by a pool registred in the deployer
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
  ) external override nonReentrant {
    poolStorage.exchangeMint(
      srcDerivative,
      derivative,
      FixedPoint.Unsigned(collateralAmount),
      FixedPoint.Unsigned(numTokens)
    );
  }

  /**
   * @notice Liquidity provider withdraw collateral from the pool
   * @param collateralAmount The amount of collateral to withdraw
   */
  function withdrawFromPool(uint256 collateralAmount)
    external
    override
    onlyLiquidityProvider
    nonReentrant
  {
    poolStorage.withdrawFromPool(FixedPoint.Unsigned(collateralAmount));
  }

  /**
   * @notice Move collateral from TIC to its derivative in order to increase GCR
   * @param derivative Derivative on which to deposit collateral
   * @param collateralAmount The amount of collateral to move into derivative
   */
  function depositIntoDerivative(
    IDerivative derivative,
    uint256 collateralAmount
  ) external override onlyLiquidityProvider nonReentrant {
    poolStorage.depositIntoDerivative(
      derivative,
      FixedPoint.Unsigned(collateralAmount)
    );
  }

  /**
   * @notice Start a slow withdrawal request
   * @notice Collateral can be withdrawn once the liveness period has elapsed
   * @param derivative Derivative from which the collateral withdrawal is requested
   * @param collateralAmount The amount of excess collateral to withdraw
   */
  function slowWithdrawRequest(IDerivative derivative, uint256 collateralAmount)
    external
    override
    onlyLiquidityProvider
    nonReentrant
  {
    poolStorage.slowWithdrawRequest(
      derivative,
      FixedPoint.Unsigned(collateralAmount)
    );
  }

  /**
   * @notice Withdraw collateral after a withdraw request has passed it's liveness period
   * @param derivative Derivative from which collateral withdrawal was requested
   * @return amountWithdrawn Amount of collateral withdrawn by slow withdrawal
   */
  function slowWithdrawPassedRequest(IDerivative derivative)
    external
    override
    onlyLiquidityProvider
    nonReentrant
    returns (uint256 amountWithdrawn)
  {
    amountWithdrawn = poolStorage.slowWithdrawPassedRequest(derivative);
  }

  /**
   * @notice Withdraw collateral immediately if the remaining collateral is above GCR
   * @param derivative Derivative from which fast withdrawal was requested
   * @param collateralAmount The amount of excess collateral to withdraw
   * @return amountWithdrawn Amount of collateral withdrawn by fast withdrawal
   */
  function fastWithdraw(IDerivative derivative, uint256 collateralAmount)
    external
    override
    onlyLiquidityProvider
    nonReentrant
    returns (uint256 amountWithdrawn)
  {
    amountWithdrawn = poolStorage.fastWithdraw(
      derivative,
      FixedPoint.Unsigned(collateralAmount)
    );
  }

  /**
   * @notice Activate emergency shutdown on a derivative in order to liquidate the token holders in case of emergency
   * @param derivative Derivative on which emergency shutdown is called
   */
  function emergencyShutdown(IDerivative derivative)
    external
    override
    onlyMaintainer
    nonReentrant
  {
    poolStorage.emergencyShutdown(derivative);
  }

  /**
   * @notice Redeem tokens after derivative emergency shutdown
   * @param derivative Derivative for which settlement is requested
   * @return amountSettled Amount of collateral withdrawn after emergency shutdown
   */
  function settleEmergencyShutdown(IDerivative derivative)
    external
    override
    nonReentrant
    returns (uint256 amountSettled)
  {
    amountSettled = poolStorage.settleEmergencyShutdown(
      derivative,
      LIQUIDITY_PROVIDER_ROLE
    );
  }

  /**
   * @notice Update the fee percentage
   * @param _feePercentage The new fee percentage
   */
  function setFeePercentage(uint256 _feePercentage)
    external
    override
    onlyMaintainer
    nonReentrant
  {
    poolStorage.setFeePercentage(FixedPoint.Unsigned(_feePercentage));
  }

  /**
   * @notice Update the addresses of recipients for generated fees and proportions of fees each address will receive
   * @param _feeRecipients An array of the addresses of recipients that will receive generated fees
   * @param _feeProportions An array of the proportions of fees generated each recipient will receive
   */
  function setFeeRecipients(
    address[] calldata _feeRecipients,
    uint32[] calldata _feeProportions
  ) external override onlyMaintainer nonReentrant {
    poolStorage.setFeeRecipients(_feeRecipients, _feeProportions);
  }

  /**
   * @notice Reset the starting collateral ratio - for example when you add a new derivative without collateral
   * @param startingCollateralRatio Initial ratio between collateral amount and synth tokens
   */
  function setStartingCollateralization(uint256 startingCollateralRatio)
    external
    override
    onlyMaintainer
    nonReentrant
  {
    poolStorage.setStartingCollateralization(
      FixedPoint.Unsigned(startingCollateralRatio)
    );
  }

  /**
   * @notice Add a role into derivative to another contract
   * @param derivative Derivative in which a role is being added
   * @param derivativeRole Role to add
   * @param addressToAdd address of EOA or smart contract to add with a role in derivative
   */
  function addRoleInDerivative(
    IDerivative derivative,
    DerivativeRoles derivativeRole,
    address addressToAdd
  ) external override onlyMaintainer nonReentrant {
    poolStorage.addRoleInDerivative(derivative, derivativeRole, addressToAdd);
  }

  /**
   * @notice Removing a role from a derivative contract
   * @param derivative Derivative in which to remove a role
   * @param derivativeRole Role to remove
   */
  function renounceRoleInDerivative(
    IDerivative derivative,
    DerivativeRoles derivativeRole
  ) external override onlyMaintainer nonReentrant {
    poolStorage.renounceRoleInDerivative(derivative, derivativeRole);
  }

  /**
   * @notice Add a role into synthetic token to another contract
   * @param derivative Derivative in which adding role
   * @param synthTokenRole Role to add
   * @param addressToAdd address of EOA or smart contract to add with a role in derivative
   */
  function addRoleInSynthToken(
    IDerivative derivative,
    SynthTokenRoles synthTokenRole,
    address addressToAdd
  ) external override onlyMaintainer nonReentrant {
    poolStorage.addRoleInSynthToken(derivative, synthTokenRole, addressToAdd);
  }

  /**
   * @notice A derivative renounces a role into synthetic token
   * @param derivative Derivative in which renounce role
   * @param synthTokenRole Role to renounce
   */
  function renounceRoleInSynthToken(
    IDerivative derivative,
    SynthTokenRoles synthTokenRole
  ) external override onlyMaintainer nonReentrant {
    poolStorage.renounceRoleInSynthToken(derivative, synthTokenRole);
  }

  /**
   * @notice Set the possibility to accept only EOA meta-tx
   * @param isContractAllowed Flag that represent options to receive tx by a contract or only EOA
   */
  function setIsContractAllowed(bool isContractAllowed)
    external
    override
    onlyMaintainer
    nonReentrant
  {
    poolStorage.setIsContractAllowed(isContractAllowed);
  }

  //----------------------------------------
  // External view functions
  //----------------------------------------

  /**
   * @notice Get Synthereum finder of the pool
   * @return finder Returns finder contract
   */
  function synthereumFinder()
    external
    view
    override
    returns (ISynthereumFinder finder)
  {
    finder = poolStorage.finder;
  }

  /**
   * @notice Get Synthereum version
   * @return poolVersion Returns the version of the Synthereum pool
   */
  function version() external view override returns (uint8 poolVersion) {
    poolVersion = poolStorage.version;
  }

  /**
   * @notice Get the collateral token
   * @return collateralCurrency The ERC20 collateral token
   */
  function collateralToken()
    external
    view
    override
    returns (IERC20 collateralCurrency)
  {
    collateralCurrency = poolStorage.collateralToken;
  }

  /**
   * @notice Get the synthetic token associated to this pool
   * @return syntheticCurrency The ERC20 synthetic token
   */
  function syntheticToken()
    external
    view
    override
    returns (IERC20 syntheticCurrency)
  {
    syntheticCurrency = poolStorage.syntheticToken;
  }

  /**
   * @notice Get all the derivatives associated to this pool
   * @return Return list of all derivatives
   */
  function getAllDerivatives()
    external
    view
    override
    returns (IDerivative[] memory)
  {
    EnumerableSet.AddressSet storage derivativesSet = poolStorage.derivatives;
    uint256 numberOfDerivatives = derivativesSet.length();
    IDerivative[] memory derivatives = new IDerivative[](numberOfDerivatives);
    for (uint256 j = 0; j < numberOfDerivatives; j++) {
      derivatives[j] = (IDerivative(derivativesSet.at(j)));
    }
    return derivatives;
  }

  /**
   * @notice Check if a derivative is in the withelist of this pool
   * @param derivative Perpetual derivative
   * @return isAdmitted Return true if in the withelist otherwise false
   */
  function isDerivativeAdmitted(IDerivative derivative)
    external
    view
    override
    returns (bool isAdmitted)
  {
    isAdmitted = poolStorage.derivatives.contains(address(derivative));
  }

  /**
   * @notice Get the starting collateral ratio of the pool
   * @return startingCollateralRatio Initial ratio between collateral amount and synth tokens
   */
  function getStartingCollateralization()
    external
    view
    override
    returns (uint256 startingCollateralRatio)
  {
    startingCollateralRatio = poolStorage.startingCollateralization.rawValue;
  }

  /**
   * @notice Get the synthetic token symbol associated to this pool
   * @return symbol The ERC20 synthetic token symbol
   */
  function syntheticTokenSymbol()
    external
    view
    override
    returns (string memory symbol)
  {
    symbol = IStandardERC20(address(poolStorage.syntheticToken)).symbol();
  }

  /**
   * @notice Returns if pool can accept only EOA meta-tx or also contract meta-tx
   * @return isAllowed True if accept also contract, false if only EOA
   */
  function isContractAllowed() external view override returns (bool isAllowed) {
    isAllowed = poolStorage.isContractAllowed;
  }

  /**
   * @notice Returns infos about fee set
   * @return fee Percentage and recipients of fee
   */
  function getFeeInfo() external view override returns (Fee memory fee) {
    fee = poolStorage.fee;
  }

  /**
   * @notice Returns nonce of user meta-signature
   * @return nonce Nonce of user
   */
  function getUserNonce(address user)
    external
    view
    override
    returns (uint256 nonce)
  {
    nonce = poolStorage.nonces[user];
  }

  /**
   * @notice Calculate the fees a user will have to pay to mint tokens with their collateral
   * @param collateralAmount Amount of collateral on which fee is calculated
   * @return fee Amount of fee that must be paid
   */
  function calculateFee(uint256 collateralAmount)
    external
    view
    override
    returns (uint256 fee)
  {
    fee = FixedPoint
      .Unsigned(collateralAmount)
      .mul(poolStorage.fee.feePercentage)
      .rawValue;
  }

  //----------------------------------------
  // Public functions
  //----------------------------------------

  /**
   * @notice Update the fee percentage, recipients and recipient proportions
   * @param _fee Fee struct containing percentage, recipients and proportions
   */
  function setFee(Fee memory _fee) public override onlyMaintainer nonReentrant {
    poolStorage.setFeePercentage(_fee.feePercentage);
    poolStorage.setFeeRecipients(_fee.feeRecipients, _fee.feeProportions);
  }

  //----------------------------------------
  // Private functions
  //----------------------------------------

  /**
   * @notice Returns the chanId of this blockchain network
   * @return id ID of the network
   */
  function getChainID() private pure returns (uint256) {
    uint256 id;
    assembly {
      id := chainid()
    }
    return id;
  }
}
