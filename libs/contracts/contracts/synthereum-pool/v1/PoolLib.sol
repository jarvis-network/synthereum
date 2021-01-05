// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import {ISynthereumPool} from './interfaces/IPool.sol';
import {ISynthereumPoolStorage} from './interfaces/IPoolStorage.sol';
import {
  FixedPoint
} from '@jarvis-network/uma-core/contracts/common/implementation/FixedPoint.sol';
import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {IDerivative} from '../../derivative/common/interfaces/IDerivative.sol';
import {IRole} from './interfaces/IRole.sol';
import {ISynthereumFinder} from '../../versioning/interfaces/IFinder.sol';
import {
  ISynthereumPoolRegistry
} from '../../versioning/interfaces/IPoolRegistry.sol';
import {SynthereumInterfaces} from '../../versioning/Constants.sol';
import {SafeERC20} from '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';
import {EnumerableSet} from '@openzeppelin/contracts/utils/EnumerableSet.sol';

/**
 * @notice Pool implementation is stored here to reduce deployment costs
 */

library SynthereumPoolLib {
  using FixedPoint for FixedPoint.Unsigned;
  using SynthereumPoolLib for ISynthereumPoolStorage.Storage;
  using SynthereumPoolLib for IDerivative;
  using EnumerableSet for EnumerableSet.AddressSet;
  using SafeERC20 for IERC20;

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

  // Check that derivative must be whitelisted in this pool
  modifier checkDerivative(
    ISynthereumPoolStorage.Storage storage self,
    IDerivative derivative
  ) {
    require(self.derivatives.contains(address(derivative)), 'Wrong derivative');
    _;
  }

  // Check that the sender must be an EOA if the flag isContractAllowed is false
  modifier checkIsSenderContract(ISynthereumPoolStorage.Storage storage self) {
    if (!self.isContractAllowed) {
      require(tx.origin == msg.sender, 'Account must be an EOA');
    }
    _;
  }

  //----------------------------------------
  // External function
  //----------------------------------------

  /**
   * @notice Initializes a fresh TIC
   * @notice The derivative's collateral currency must be a Collateral Token
   * @notice The validator will generally be an address owned by the LP
   * @notice `_startingCollateralization should be greater than the expected asset price multiplied
   *      by the collateral requirement. The degree to which it is greater should be based on
   *      the expected asset volatility.
   * @param self Data type the library is attached to
   * @param _version Synthereum version of the pool
   * @param _finder Synthereum finder
   * @param _derivative The perpetual derivative
   * @param _startingCollateralization Collateralization ratio to use before a global one is set
   * @param _isContractAllowed Enable or disable the option to accept meta-tx only by an EOA for security reason
   */
  function initialize(
    ISynthereumPoolStorage.Storage storage self,
    uint8 _version,
    ISynthereumFinder _finder,
    IDerivative _derivative,
    FixedPoint.Unsigned memory _startingCollateralization,
    bool _isContractAllowed
  ) external {
    self.derivatives.add(address(_derivative));
    emit AddDerivative(address(this), address(_derivative));
    self.version = _version;
    self.finder = _finder;
    self.startingCollateralization = _startingCollateralization;
    self.isContractAllowed = _isContractAllowed;
    self.collateralToken = getDerivativeCollateral(_derivative);
    self.syntheticToken = _derivative.tokenCurrency();
  }

  /**
   * @notice Add a derivate to be linked to this pool
   * @param self Data type the library is attached to
   * @param derivative A perpetual derivative
   */
  function addDerivative(
    ISynthereumPoolStorage.Storage storage self,
    IDerivative derivative
  ) external {
    require(
      self.collateralToken == getDerivativeCollateral(derivative),
      'Wrong collateral of the new derivative'
    );
    require(
      self.syntheticToken == derivative.tokenCurrency(),
      'Wrong synthetic token'
    );
    require(
      self.derivatives.add(address(derivative)),
      'Derivative has already been included'
    );
    emit AddDerivative(address(this), address(derivative));
  }

  /**
   * @notice Remove a derivate linked to this pool
   * @param self Data type the library is attached to
   * @param derivative A perpetual derivative
   */
  function removeDerivative(
    ISynthereumPoolStorage.Storage storage self,
    IDerivative derivative
  ) external checkDerivative(self, derivative) {
    require(
      self.derivatives.remove(address(derivative)),
      'Derivative has already been included'
    );
    emit RemoveDerivative(address(this), address(derivative));
  }

  /**
   * @notice Mint tokens using collateral
   * @notice This require the meta-signature of a validator
   * @notice User must approve collateral transfer for the mint request to succeed
   * @param self Data type the library is attached to
   * @param mintMetaTx Meta-tx containing mint parameters
   * @param signatureVerificationParams Parameters needed for signature verification
   * @return feePaid Amount of collateral paid by minter as fee
   */
  function mint(
    ISynthereumPoolStorage.Storage storage self,
    ISynthereumPool.MintParameters memory mintMetaTx,
    ISynthereumPool.SignatureVerificationParams
      memory signatureVerificationParams
  ) external checkIsSenderContract(self) returns (uint256 feePaid) {
    bytes32 digest =
      generateMintDigest(
        mintMetaTx,
        signatureVerificationParams.domain_separator,
        signatureVerificationParams.typeHash
      );
    checkSignature(
      signatureVerificationParams.validator_role,
      digest,
      signatureVerificationParams.signature
    );
    self.checkMetaTxParams(
      mintMetaTx.sender,
      mintMetaTx.derivativeAddr,
      mintMetaTx.feePercentage,
      mintMetaTx.nonce,
      mintMetaTx.expiration
    );
    FixedPoint.Unsigned memory collateralAmount =
      FixedPoint.Unsigned(mintMetaTx.collateralAmount);
    FixedPoint.Unsigned memory numTokens =
      FixedPoint.Unsigned(mintMetaTx.numTokens);
    IDerivative derivative = IDerivative(mintMetaTx.derivativeAddr);
    FixedPoint.Unsigned memory globalCollateralization =
      derivative.getGlobalCollateralizationRatio();

    // Target the starting collateralization ratio if there is no global ratio
    FixedPoint.Unsigned memory targetCollateralization =
      globalCollateralization.isGreaterThan(0)
        ? globalCollateralization
        : self.startingCollateralization;

    // Check that LP collateral can support the tokens to be minted
    require(
      self.checkCollateralizationRatio(
        targetCollateralization,
        collateralAmount,
        numTokens
      ),
      'Insufficient collateral available from Liquidity Provider'
    );

    // Calculate fees
    FixedPoint.Unsigned memory feeTotal =
      collateralAmount.mul(self.fee.feePercentage);

    // Pull user's collateral and mint fee into the pool
    self.pullCollateral(mintMetaTx.sender, collateralAmount.add(feeTotal));

    // Mint synthetic asset with collateral from user and liquidity provider
    self.mintSynTokens(
      derivative,
      numTokens.mulCeil(targetCollateralization),
      numTokens
    );

    // Transfer synthetic assets to the user
    self.transferSynTokens(mintMetaTx.sender, numTokens);

    // Send fees
    self.sendFee(feeTotal);

    feePaid = feeTotal.rawValue;

    emit Mint(
      mintMetaTx.sender,
      address(this),
      collateralAmount.add(feeTotal).rawValue,
      numTokens.rawValue,
      feePaid
    );
  }

  /**
   * @notice Submit a request to redeem tokens
   * @notice This requires the meta-signature of a validator
   * @notice User must approve synthetic token transfer for the redeem request to succeed
   * @param self Data type the library is attached to
   * @param redeemMetaTx Meta-tx containing redeem parameters
   * @param signatureVerificationParams Parameters needed for signature verification
   * @return feePaid Amount of collateral paid by redemeer as fee
   */
  function redeem(
    ISynthereumPoolStorage.Storage storage self,
    ISynthereumPool.RedeemParameters memory redeemMetaTx,
    ISynthereumPool.SignatureVerificationParams
      memory signatureVerificationParams
  ) external checkIsSenderContract(self) returns (uint256 feePaid) {
    bytes32 digest =
      generateRedeemDigest(
        redeemMetaTx,
        signatureVerificationParams.domain_separator,
        signatureVerificationParams.typeHash
      );
    checkSignature(
      signatureVerificationParams.validator_role,
      digest,
      signatureVerificationParams.signature
    );
    self.checkMetaTxParams(
      redeemMetaTx.sender,
      redeemMetaTx.derivativeAddr,
      redeemMetaTx.feePercentage,
      redeemMetaTx.nonce,
      redeemMetaTx.expiration
    );

    FixedPoint.Unsigned memory collateralAmount =
      FixedPoint.Unsigned(redeemMetaTx.collateralAmount);
    FixedPoint.Unsigned memory numTokens =
      FixedPoint.Unsigned(redeemMetaTx.numTokens);
    IDerivative derivative = IDerivative(redeemMetaTx.derivativeAddr);

    FixedPoint.Unsigned memory amountWithdrawn =
      redeemForCollateral(redeemMetaTx.sender, derivative, numTokens);
    require(amountWithdrawn.isGreaterThan(collateralAmount));

    // Calculate fees
    FixedPoint.Unsigned memory feeTotal =
      collateralAmount.mul(self.fee.feePercentage);

    uint256 netReceivedCollateral = (collateralAmount.sub(feeTotal)).rawValue;

    //Send net amount of collateral to the user that submited the redeem request
    self.collateralToken.safeTransfer(
      redeemMetaTx.sender,
      netReceivedCollateral
    );
    // Send fees collected
    self.sendFee(feeTotal);

    feePaid = feeTotal.rawValue;

    emit Redeem(
      redeemMetaTx.sender,
      address(this),
      numTokens.rawValue,
      netReceivedCollateral,
      feePaid
    );
  }

  /**
   * @notice Submit a request to exchange tokens for other synthetic tokens
   * @notice This requires the meta-signature of a validator
   * @notice User must approve synthetic token transfer for the exchange request to succeed
   * @param self Data type the library is attached to
   * @param exchangeMetaTx Meta-tx containing exchange parameters
   * @param signatureVerificationParams Parameters needed for signature verification
   * @return feePaid Amount of collateral paid by user as fee
   */
  function exchange(
    ISynthereumPoolStorage.Storage storage self,
    ISynthereumPool.ExchangeParameters memory exchangeMetaTx,
    ISynthereumPool.SignatureVerificationParams
      memory signatureVerificationParams
  ) external checkIsSenderContract(self) returns (uint256 feePaid) {
    {
      bytes32 digest =
        generateExchangeDigest(
          exchangeMetaTx,
          signatureVerificationParams.domain_separator,
          signatureVerificationParams.typeHash
        );
      checkSignature(
        signatureVerificationParams.validator_role,
        digest,
        signatureVerificationParams.signature
      );
      self.checkMetaTxParams(
        exchangeMetaTx.sender,
        exchangeMetaTx.derivativeAddr,
        exchangeMetaTx.feePercentage,
        exchangeMetaTx.nonce,
        exchangeMetaTx.expiration
      );
    }
    FixedPoint.Unsigned memory collateralAmount =
      FixedPoint.Unsigned(exchangeMetaTx.collateralAmount);
    FixedPoint.Unsigned memory numTokens =
      FixedPoint.Unsigned(exchangeMetaTx.numTokens);
    IDerivative derivative = IDerivative(exchangeMetaTx.derivativeAddr);
    IDerivative destDerivative = IDerivative(exchangeMetaTx.destDerivativeAddr);
    //ISynthereumPool destPool = ISynthereumPool(exchangeMetaTx.destPoolAddr);
    FixedPoint.Unsigned memory amountWithdrawn =
      redeemForCollateral(exchangeMetaTx.sender, derivative, numTokens);
    self.checkPool(
      ISynthereumPool(exchangeMetaTx.destPoolAddr),
      destDerivative
    );
    require(
      amountWithdrawn.isGreaterThan(collateralAmount),
      'No tokens were redeemed'
    );

    // Calculate fees
    FixedPoint.Unsigned memory feeTotal =
      collateralAmount.mul(self.fee.feePercentage);

    self.sendFee(feeTotal);

    FixedPoint.Unsigned memory destinationCollateral =
      amountWithdrawn.sub(feeTotal);

    self.collateralToken.safeApprove(
      exchangeMetaTx.destPoolAddr,
      destinationCollateral.rawValue
    );

    // Mint the destination tokens with the withdrawn collateral
    ISynthereumPool(exchangeMetaTx.destPoolAddr).exchangeMint(
      derivative,
      destDerivative,
      destinationCollateral.rawValue,
      exchangeMetaTx.destNumTokens
    );

    // Transfer the new tokens to the user
    destDerivative.tokenCurrency().safeTransfer(
      exchangeMetaTx.sender,
      exchangeMetaTx.destNumTokens
    );

    feePaid = feeTotal.rawValue;

    emit Exchange(
      exchangeMetaTx.sender,
      address(this),
      exchangeMetaTx.destPoolAddr,
      numTokens.rawValue,
      exchangeMetaTx.destNumTokens,
      feePaid
    );
  }

  /**
   * @notice Called by a source TIC's `exchange` function to mint destination tokens
   * @notice This functon can be called only by a pool registred in the deployer
   * @param self Data type the library is attached to
   * @param srcDerivative Derivative used by the source pool
   * @param derivative Derivative that this pool will use
   * @param collateralAmount The amount of collateral to use from the source TIC
   * @param numTokens The number of new tokens to mint
   */
  function exchangeMint(
    ISynthereumPoolStorage.Storage storage self,
    IDerivative srcDerivative,
    IDerivative derivative,
    FixedPoint.Unsigned memory collateralAmount,
    FixedPoint.Unsigned memory numTokens
  ) external {
    self.checkPool(ISynthereumPool(msg.sender), srcDerivative);
    FixedPoint.Unsigned memory globalCollateralization =
      derivative.getGlobalCollateralizationRatio();

    // Target the starting collateralization ratio if there is no global ratio
    FixedPoint.Unsigned memory targetCollateralization =
      globalCollateralization.isGreaterThan(0)
        ? globalCollateralization
        : self.startingCollateralization;

    // Check that LP collateral can support the tokens to be minted
    require(
      self.checkCollateralizationRatio(
        targetCollateralization,
        collateralAmount,
        numTokens
      ),
      'Insufficient collateral available from Liquidity Provider'
    );

    // Pull Collateral Tokens from calling TIC contract
    self.pullCollateral(msg.sender, collateralAmount);

    // Mint new tokens with the collateral
    self.mintSynTokens(
      derivative,
      numTokens.mulCeil(targetCollateralization),
      numTokens
    );

    // Transfer new tokens back to the calling TIC where they will be sent to the user
    self.transferSynTokens(msg.sender, numTokens);
  }

  /**
   * @notice Liquidity provider withdraw collateral from the pool
   * @param self Data type the library is attached to
   * @param collateralAmount The amount of collateral to withdraw
   */
  function withdrawFromPool(
    ISynthereumPoolStorage.Storage storage self,
    FixedPoint.Unsigned memory collateralAmount
  ) external {
    // Transfer the collateral from this pool to the LP sender
    self.collateralToken.safeTransfer(msg.sender, collateralAmount.rawValue);
  }

  /**
   * @notice Move collateral from TIC to its derivative in order to increase GCR
   * @param self Data type the library is attached to
   * @param derivative Derivative on which to deposit collateral
   * @param collateralAmount The amount of collateral to move into derivative
   */
  function depositIntoDerivative(
    ISynthereumPoolStorage.Storage storage self,
    IDerivative derivative,
    FixedPoint.Unsigned memory collateralAmount
  ) external checkDerivative(self, derivative) {
    self.collateralToken.approve(
      address(derivative),
      collateralAmount.rawValue
    );
    derivative.deposit(collateralAmount);
  }

  /**
   * @notice Start a withdrawal request
   * @notice Collateral can be withdrawn once the liveness period has elapsed
   * @param self Data type the library is attached to
   * @param derivative Derivative from which request collateral withdrawal
   * @param collateralAmount The amount of short margin to withdraw
   */
  function slowWithdrawRequest(
    ISynthereumPoolStorage.Storage storage self,
    IDerivative derivative,
    FixedPoint.Unsigned memory collateralAmount
  ) external checkDerivative(self, derivative) {
    derivative.requestWithdrawal(collateralAmount);
  }

  /**
   * @notice Withdraw collateral after a withdraw request has passed it's liveness period
   * @param self Data type the library is attached to
   * @param derivative Derivative from which collateral withdrawal was requested
   * @return amountWithdrawn Amount of collateral withdrawn by slow withdrawal
   */
  function slowWithdrawPassedRequest(
    ISynthereumPoolStorage.Storage storage self,
    IDerivative derivative
  )
    external
    checkDerivative(self, derivative)
    returns (uint256 amountWithdrawn)
  {
    FixedPoint.Unsigned memory totalAmountWithdrawn =
      derivative.withdrawPassedRequest();
    amountWithdrawn = liquidateWithdrawal(
      self,
      totalAmountWithdrawn,
      msg.sender
    );
  }

  /**
   * @notice Withdraw collateral immediately if the remaining collateral is above GCR
   * @param self Data type the library is attached to
   * @param derivative Derivative from which fast withdrawal was requested
   * @param collateralAmount The amount of excess collateral to withdraw
   * @return amountWithdrawn Amount of collateral withdrawn by fast withdrawal
   */
  function fastWithdraw(
    ISynthereumPoolStorage.Storage storage self,
    IDerivative derivative,
    FixedPoint.Unsigned memory collateralAmount
  )
    external
    checkDerivative(self, derivative)
    returns (uint256 amountWithdrawn)
  {
    FixedPoint.Unsigned memory totalAmountWithdrawn =
      derivative.withdraw(collateralAmount);
    amountWithdrawn = liquidateWithdrawal(
      self,
      totalAmountWithdrawn,
      msg.sender
    );
  }

  /**
   * @notice Actiavte emergency shutdown on a derivative in order to liquidate the token holders in case of emergency
   * @param self Data type the library is attached to
   * @param derivative Derivative on which emergency shutdown is called
   */
  function emergencyShutdown(
    ISynthereumPoolStorage.Storage storage self,
    IDerivative derivative
  ) external checkDerivative(self, derivative) {
    derivative.emergencyShutdown();
  }

  /**
   * @notice Redeem tokens after derivative emergency shutdown
   * @param self Data type the library is attached to
   * @param derivative Derivative for which settlement is requested
   * @param liquidity_provider_role Lp role
   * @return amountSettled Amount of collateral withdrawn after emergency shutdown
   */
  function settleEmergencyShutdown(
    ISynthereumPoolStorage.Storage storage self,
    IDerivative derivative,
    bytes32 liquidity_provider_role
  ) external returns (uint256 amountSettled) {
    IERC20 tokenCurrency = self.syntheticToken;

    IERC20 collateralToken = self.collateralToken;

    FixedPoint.Unsigned memory numTokens =
      FixedPoint.Unsigned(tokenCurrency.balanceOf(msg.sender));

    //Check if sender is a LP
    bool isLiquidityProvider =
      IRole(address(this)).hasRole(liquidity_provider_role, msg.sender);

    // Make sure there is something for the user to settle
    require(
      numTokens.isGreaterThan(0) || isLiquidityProvider,
      'Account has nothing to settle'
    );

    if (numTokens.isGreaterThan(0)) {
      // Move synthetic tokens from the user to the pool
      // - This is because derivative expects the tokens to come from the sponsor address
      tokenCurrency.safeTransferFrom(
        msg.sender,
        address(this),
        numTokens.rawValue
      );

      // Allow the derivative to transfer tokens from the pool
      tokenCurrency.safeApprove(address(derivative), numTokens.rawValue);
    }

    // Redeem the synthetic tokens for collateral
    derivative.settleEmergencyShutdown();

    // Amount of collateral that will be redeemed and sent to the user
    FixedPoint.Unsigned memory totalToRedeem;

    // If the user is the LP, send redeemed token collateral plus excess collateral
    if (isLiquidityProvider) {
      // Redeem LP collateral held in pool
      // Includes excess collateral withdrawn by a user previously calling `settleEmergencyShutdown`
      totalToRedeem = FixedPoint.Unsigned(
        collateralToken.balanceOf(address(this))
      );
    } else {
      // Otherwise, separate excess collateral from redeemed token value
      // Must be called after `emergencyShutdown` to make sure expiryPrice is set
      FixedPoint.Unsigned memory dueCollateral =
        numTokens.mul(derivative.emergencyShutdownPrice());
      totalToRedeem = FixedPoint.min(
        dueCollateral,
        FixedPoint.Unsigned(address(this).balance)
      );
    }
    amountSettled = totalToRedeem.rawValue;
    // Redeem the collateral for the underlying asset and transfer to the user
    collateralToken.safeTransfer(msg.sender, amountSettled);

    emit Settlement(
      address(this),
      msg.sender,
      numTokens.rawValue,
      amountSettled
    );
  }

  /**
   * @notice Update the fee percentage
   * @param self Data type the library is attached to
   * @param _feePercentage The new fee percentage
   */
  function setFeePercentage(
    ISynthereumPoolStorage.Storage storage self,
    FixedPoint.Unsigned memory _feePercentage
  ) external {
    require(
      _feePercentage.rawValue < 10**(18),
      'Fee Percentage must be less than 100%'
    );
    self.fee.feePercentage = _feePercentage;
    emit SetFeePercentage(_feePercentage.rawValue);
  }

  /**
   * @notice Update the addresses of recipients for generated fees and proportions of fees each address will receive
   * @param self Data type the library is attached to
   * @param _feeRecipients An array of the addresses of recipients that will receive generated fees
   * @param _feeProportions An array of the proportions of fees generated each recipient will receive
   */
  function setFeeRecipients(
    ISynthereumPoolStorage.Storage storage self,
    address[] calldata _feeRecipients,
    uint32[] calldata _feeProportions
  ) external {
    require(
      _feeRecipients.length == _feeProportions.length,
      'Fee recipients and fee proportions do not match'
    );
    uint256 totalActualFeeProportions;
    // Store the sum of all proportions
    for (uint256 i = 0; i < _feeProportions.length; i++) {
      totalActualFeeProportions += _feeProportions[i];
    }
    self.fee.feeRecipients = _feeRecipients;
    self.fee.feeProportions = _feeProportions;
    self.totalFeeProportions = totalActualFeeProportions;
    emit SetFeeRecipients(_feeRecipients, _feeProportions);
  }

  /**
   * @notice Reset the starting collateral ratio - for example when you add a new derivative without collateral
   * @param startingCollateralRatio Initial ratio between collateral amount and synth tokens
   */
  function setStartingCollateralization(
    ISynthereumPoolStorage.Storage storage self,
    FixedPoint.Unsigned memory startingCollateralRatio
  ) external {
    self.startingCollateralization = startingCollateralRatio;
  }

  /**
   * @notice Add a role into derivative to another contract
   * @param self Data type the library is attached to
   * @param derivative Derivative in which a role is being added
   * @param derivativeRole Role to add
   * @param addressToAdd address of EOA or smart contract to add with a role in derivative
   */
  function addRoleInDerivative(
    ISynthereumPoolStorage.Storage storage self,
    IDerivative derivative,
    ISynthereumPool.DerivativeRoles derivativeRole,
    address addressToAdd
  ) external checkDerivative(self, derivative) {
    if (derivativeRole == ISynthereumPool.DerivativeRoles.ADMIN) {
      derivative.addAdmin(addressToAdd);
    } else {
      ISynthereumPool pool = ISynthereumPool(addressToAdd);
      IERC20 collateralToken = self.collateralToken;
      require(
        collateralToken == pool.collateralToken(),
        'Collateral tokens do not match'
      );
      require(
        self.syntheticToken == pool.syntheticToken(),
        'Synthetic tokens do not match'
      );
      ISynthereumFinder finder = self.finder;
      require(finder == pool.synthereumFinder(), 'Finders do not match');
      ISynthereumPoolRegistry poolRegister =
        ISynthereumPoolRegistry(
          finder.getImplementationAddress(SynthereumInterfaces.PoolRegistry)
        );
      poolRegister.isPoolDeployed(
        pool.syntheticTokenSymbol(),
        collateralToken,
        pool.version(),
        address(pool)
      );
      if (derivativeRole == ISynthereumPool.DerivativeRoles.POOL) {
        derivative.addPool(addressToAdd);
      } else if (
        derivativeRole == ISynthereumPool.DerivativeRoles.ADMIN_AND_POOL
      ) {
        derivative.addAdminAndPool(addressToAdd);
      }
    }
  }

  /**
   * @notice Removing a role from a derivative contract
   * @param self Data type the library is attached to
   * @param derivative Derivative in which to remove a role
   * @param derivativeRole Role to remove
   */
  function renounceRoleInDerivative(
    ISynthereumPoolStorage.Storage storage self,
    IDerivative derivative,
    ISynthereumPool.DerivativeRoles derivativeRole
  ) external checkDerivative(self, derivative) {
    if (derivativeRole == ISynthereumPool.DerivativeRoles.ADMIN) {
      derivative.renounceAdmin();
    } else if (derivativeRole == ISynthereumPool.DerivativeRoles.POOL) {
      derivative.renouncePool();
    } else if (
      derivativeRole == ISynthereumPool.DerivativeRoles.ADMIN_AND_POOL
    ) {
      derivative.renounceAdminAndPool();
    }
  }

  /**
   * @notice Add a role into synthetic token to another contract
   * @param self Data type the library is attached to
   * @param derivative Derivative in which adding role
   * @param synthTokenRole Role to add
   * @param addressToAdd address of EOA or smart contract to add with a role in derivative
   */
  function addRoleInSynthToken(
    ISynthereumPoolStorage.Storage storage self,
    IDerivative derivative,
    ISynthereumPool.SynthTokenRoles synthTokenRole,
    address addressToAdd
  ) external checkDerivative(self, derivative) {
    if (synthTokenRole == ISynthereumPool.SynthTokenRoles.ADMIN) {
      derivative.addSyntheticTokenAdmin(addressToAdd);
    } else {
      require(
        self.syntheticToken == IDerivative(addressToAdd).tokenCurrency(),
        'Synthetic tokens do not match'
      );
      if (synthTokenRole == ISynthereumPool.SynthTokenRoles.MINTER) {
        derivative.addSyntheticTokenMinter(addressToAdd);
      } else if (synthTokenRole == ISynthereumPool.SynthTokenRoles.BURNER) {
        derivative.addSyntheticTokenBurner(addressToAdd);
      } else if (
        synthTokenRole ==
        ISynthereumPool.SynthTokenRoles.ADMIN_AND_MINTER_AND_BURNER
      ) {
        derivative.addSyntheticTokenAdminAndMinterAndBurner(addressToAdd);
      }
    }
  }

  /**
   * @notice A derivative renounces a role into synthetic token
   * @param self Data type the library is attached to
   * @param derivative Derivative in which renounce role
   * @param synthTokenRole Role to renounce
   */
  function renounceRoleInSynthToken(
    ISynthereumPoolStorage.Storage storage self,
    IDerivative derivative,
    ISynthereumPool.SynthTokenRoles synthTokenRole
  ) external checkDerivative(self, derivative) {
    if (synthTokenRole == ISynthereumPool.SynthTokenRoles.ADMIN) {
      derivative.renounceSyntheticTokenAdmin();
    } else if (synthTokenRole == ISynthereumPool.SynthTokenRoles.MINTER) {
      derivative.renounceSyntheticTokenMinter();
    } else if (synthTokenRole == ISynthereumPool.SynthTokenRoles.BURNER) {
      derivative.renounceSyntheticTokenBurner();
    } else if (
      synthTokenRole ==
      ISynthereumPool.SynthTokenRoles.ADMIN_AND_MINTER_AND_BURNER
    ) {
      derivative.renounceSyntheticTokenAdminAndMinterAndBurner();
    }
  }

  /**
   * @notice Set the possibility to accept only EOA meta-tx
   * @param self Data type the library is attached to
   * @param isContractAllowed Flag that represent options to receive tx by a contract or only EOA
   */
  function setIsContractAllowed(
    ISynthereumPoolStorage.Storage storage self,
    bool isContractAllowed
  ) external {
    require(
      self.isContractAllowed != isContractAllowed,
      'Contract flag already set'
    );
    self.isContractAllowed = isContractAllowed;
  }

  //----------------------------------------
  //  Internal functions
  //----------------------------------------

  /**
   * @notice Check that parameters of meta tx are correct
   * @param self Data type the library is attached to
   * @param sender Meta-tx sender
   * @param derivativeAddr Address of the derivative associate to this pool
   * @param nonce Sender progessive nonce
   * @param expiration Expiration timetstamp of meta-tx
   */
  function checkMetaTxParams(
    ISynthereumPoolStorage.Storage storage self,
    address sender,
    address derivativeAddr,
    uint256 feePercentage,
    uint256 nonce,
    uint256 expiration
  ) internal checkDerivative(self, IDerivative(derivativeAddr)) {
    require(sender == msg.sender, 'Wrong user account');
    require(now <= expiration, 'Meta-signature expired');
    require(
      feePercentage == self.fee.feePercentage.rawValue,
      'Wrong fee percentage'
    );
    require(nonce == self.nonces[sender]++, 'Invalid nonce');
  }

  /**
   * @notice Pulls collateral tokens from the sender to store in the TIC
   * @param self Data type the library is attached to
   * @param numTokens The number of tokens to pull
   */
  function pullCollateral(
    ISynthereumPoolStorage.Storage storage self,
    address from,
    FixedPoint.Unsigned memory numTokens
  ) internal {
    self.collateralToken.safeTransferFrom(
      from,
      address(this),
      numTokens.rawValue
    );
  }

  /**
   * @notice Mints synthetic tokens with the available collateral
   * @param self Data type the library is attached to
   * @param collateralAmount The amount of collateral to send
   * @param numTokens The number of tokens to mint
   */
  function mintSynTokens(
    ISynthereumPoolStorage.Storage storage self,
    IDerivative derivative,
    FixedPoint.Unsigned memory collateralAmount,
    FixedPoint.Unsigned memory numTokens
  ) internal {
    self.collateralToken.safeApprove(
      address(derivative),
      collateralAmount.rawValue
    );
    derivative.create(collateralAmount, numTokens);
  }

  /**
   * @notice Transfer synthetic tokens from the derivative to an address
   * @dev Refactored from `mint` to guard against reentrancy
   * @param self Data type the library is attached to
   * @param recipient The address to send the tokens
   * @param numTokens The number of tokens to send
   */
  function transferSynTokens(
    ISynthereumPoolStorage.Storage storage self,
    address recipient,
    FixedPoint.Unsigned memory numTokens
  ) internal {
    self.syntheticToken.safeTransfer(recipient, numTokens.rawValue);
  }

  /**
   * @notice Redeem synthetic tokens for collateral from the derivative
   * @param tokenHolder Address of the user that redeems
   * @param derivative Derivative from which collateral is redeemed
   * @param numTokens The number of tokens to redeem
   * @return amountWithdrawn Collateral amount withdrawn by redeem execution
   */
  function redeemForCollateral(
    address tokenHolder,
    IDerivative derivative,
    FixedPoint.Unsigned memory numTokens
  ) internal returns (FixedPoint.Unsigned memory amountWithdrawn) {
    require(numTokens.isGreaterThan(0));

    IERC20 tokenCurrency = derivative.positionManagerData().tokenCurrency;
    require(tokenCurrency.balanceOf(tokenHolder) >= numTokens.rawValue);

    // Move synthetic tokens from the user to the TIC
    // - This is because derivative expects the tokens to come from the sponsor address
    tokenCurrency.safeTransferFrom(
      tokenHolder,
      address(this),
      numTokens.rawValue
    );

    // Allow the derivative to transfer tokens from the TIC
    tokenCurrency.safeApprove(address(derivative), numTokens.rawValue);

    // Redeem the synthetic tokens for Collateral tokens
    amountWithdrawn = derivative.redeem(numTokens);
  }

  /**
   * @notice Send collateral withdrawn by the derivative to the LP
   * @param self Data type the library is attached to
   * @param collateralAmount Amount of collateral to send to the LP
   * @param recipient Address of a LP
   * @return amountWithdrawn Collateral amount withdrawn
   */
  function liquidateWithdrawal(
    ISynthereumPoolStorage.Storage storage self,
    FixedPoint.Unsigned memory collateralAmount,
    address recipient
  ) internal returns (uint256 amountWithdrawn) {
    require(collateralAmount.isGreaterThan(0), 'No tokens were redeemed');
    amountWithdrawn = collateralAmount.rawValue;
    self.collateralToken.safeTransfer(recipient, amountWithdrawn);
  }

  /**
   * @notice Set the TIC fee structure parameters
   * @param self Data type the library is attached tfo
   * @param _feeAmount Amount of fee to send
   */
  function sendFee(
    ISynthereumPoolStorage.Storage storage self,
    FixedPoint.Unsigned memory _feeAmount
  ) internal {
    // Distribute fees
    // TODO Consider using the withdrawal pattern for fees
    for (uint256 i = 0; i < self.fee.feeRecipients.length; i++) {
      require(
        self.collateralToken.transfer(
          self.fee.feeRecipients[i],
          // This order is important because it mixes FixedPoint with unscaled uint
          _feeAmount
            .mul(self.fee.feeProportions[i])
            .div(self.totalFeeProportions)
            .rawValue
        )
      );
    }
  }

  //----------------------------------------
  //  Internal views
  //----------------------------------------

  /**
   * @notice Get the address of collateral of a perpetual derivative
   * @param derivative Address of the perpetual derivative
   * @return collateral Address of the collateral of perpetual derivative
   */
  function getDerivativeCollateral(IDerivative derivative)
    internal
    view
    returns (IERC20 collateral)
  {
    collateral = derivative.collateralCurrency();
  }

  /**
   * @notice Get the global collateralization ratio of the derivative
   * @param derivative Perpetual derivative contract
   * @return The global collateralization ratio
   */
  function getGlobalCollateralizationRatio(IDerivative derivative)
    internal
    view
    returns (FixedPoint.Unsigned memory)
  {
    FixedPoint.Unsigned memory totalTokensOutstanding =
      derivative.globalPositionData().totalTokensOutstanding;
    if (totalTokensOutstanding.isGreaterThan(0)) {
      return derivative.totalPositionCollateral().div(totalTokensOutstanding);
    } else {
      return FixedPoint.fromUnscaledUint(0);
    }
  }

  /**
   * @notice Check if a call to `mint` with the supplied parameters will succeed
   * @dev Compares the new collateral from `collateralAmount` combined with LP collateral
   *      against the collateralization ratio of the derivative.
   * @param self Data type the library is attached to
   * @param globalCollateralization The global collateralization ratio of the derivative
   * @param collateralAmount The amount of additional collateral supplied
   * @param numTokens The number of tokens to mint
   * @return `true` if there is sufficient collateral
   */
  function checkCollateralizationRatio(
    ISynthereumPoolStorage.Storage storage self,
    FixedPoint.Unsigned memory globalCollateralization,
    FixedPoint.Unsigned memory collateralAmount,
    FixedPoint.Unsigned memory numTokens
  ) internal view returns (bool) {
    // Collateral ratio possible for new tokens accounting for LP collateral
    FixedPoint.Unsigned memory newCollateralization =
      collateralAmount
        .add(FixedPoint.Unsigned(self.collateralToken.balanceOf(address(this))))
        .div(numTokens);

    // Check that LP collateral can support the tokens to be minted
    return newCollateralization.isGreaterThanOrEqual(globalCollateralization);
  }

  /**
   * @notice Check if sender or receiver pool is a correct registered pool
   * @param self Data type the library is attached to
   * @param poolToCheck Pool that should be compared with this pool
   * @param derivativeToCheck Derivative of poolToCheck
   */
  function checkPool(
    ISynthereumPoolStorage.Storage storage self,
    ISynthereumPool poolToCheck,
    IDerivative derivativeToCheck
  ) internal view {
    require(
      poolToCheck.isDerivativeAdmitted(derivativeToCheck),
      'Wrong derivative'
    );

    IERC20 collateralToken = self.collateralToken;
    require(
      collateralToken == poolToCheck.collateralToken(),
      'Collateral tokens do not match'
    );
    ISynthereumFinder finder = self.finder;
    require(finder == poolToCheck.synthereumFinder(), 'Finders do not match');
    ISynthereumPoolRegistry poolRegister =
      ISynthereumPoolRegistry(
        finder.getImplementationAddress(SynthereumInterfaces.PoolRegistry)
      );
    poolRegister.isPoolDeployed(
      poolToCheck.syntheticTokenSymbol(),
      collateralToken,
      poolToCheck.version(),
      address(poolToCheck)
    );
  }

  //----------------------------------------
  //  Internal pure
  //----------------------------------------

  /**
   * @notice Generate and return the hash of the mint message of the meta-tx
   * @param mintMetaTx Meta-tx containing mint parameters
   * @param domain_separator Domain separator according to EIP712
   * @param typeHash TypeHash of MintParameters struct according to EIP712
   * @return digest Hash of the mint message of the meta-tx
   */
  function generateMintDigest(
    ISynthereumPool.MintParameters memory mintMetaTx,
    bytes32 domain_separator,
    bytes32 typeHash
  ) internal pure returns (bytes32 digest) {
    digest = keccak256(
      abi.encodePacked(
        '\x19\x01',
        domain_separator,
        keccak256(
          abi.encode(
            typeHash,
            mintMetaTx.sender,
            mintMetaTx.derivativeAddr,
            mintMetaTx.collateralAmount,
            mintMetaTx.numTokens,
            mintMetaTx.feePercentage,
            mintMetaTx.nonce,
            mintMetaTx.expiration
          )
        )
      )
    );
  }

  /**
   * @notice Generate and return the hash of the redeem message of the meta-tx
   * @param redeemMetaTx Meta-tx containing redeem parameters
   * @param domain_separator Domain separator according to EIP712
   *@param typeHash TypeHash of RedeemParameters struct according to EIP712
   * @return digest Hash of the redeem message of the meta-tx
   */
  function generateRedeemDigest(
    ISynthereumPool.RedeemParameters memory redeemMetaTx,
    bytes32 domain_separator,
    bytes32 typeHash
  ) internal pure returns (bytes32 digest) {
    digest = keccak256(
      abi.encodePacked(
        '\x19\x01',
        domain_separator,
        keccak256(
          abi.encode(
            typeHash,
            redeemMetaTx.sender,
            redeemMetaTx.derivativeAddr,
            redeemMetaTx.collateralAmount,
            redeemMetaTx.numTokens,
            redeemMetaTx.feePercentage,
            redeemMetaTx.nonce,
            redeemMetaTx.expiration
          )
        )
      )
    );
  }

  /**
   * @notice Generate and return the hash of the exchange message of the meta-tx
   * @param exchangeMetaTx Meta-tx containing exchange parameters
   * @param domain_separator Domain separator according to EIP712
   *@param typeHash TypeHash of ExchangeParameters struct according to EIP712
   * @return digest Hash of the exchange message of the meta-tx
   */
  function generateExchangeDigest(
    ISynthereumPool.ExchangeParameters memory exchangeMetaTx,
    bytes32 domain_separator,
    bytes32 typeHash
  ) internal pure returns (bytes32 digest) {
    digest = keccak256(
      abi.encodePacked(
        '\x19\x01',
        domain_separator,
        keccak256(
          abi.encode(
            typeHash,
            exchangeMetaTx.sender,
            exchangeMetaTx.derivativeAddr,
            exchangeMetaTx.destPoolAddr,
            exchangeMetaTx.destDerivativeAddr,
            exchangeMetaTx.numTokens,
            exchangeMetaTx.collateralAmount,
            exchangeMetaTx.destNumTokens,
            exchangeMetaTx.feePercentage,
            exchangeMetaTx.nonce,
            exchangeMetaTx.expiration
          )
        )
      )
    );
  }

  /**
   * @notice Check if signature of a validator is correct
   * @param validator_role Validator role
   * @param digest Message hash
   * @param signature Validator signature
   */
  function checkSignature(
    bytes32 validator_role,
    bytes32 digest,
    ISynthereumPool.Signature memory signature
  ) internal view {
    address signatureAddr =
      ecrecover(digest, signature.v, signature.r, signature.s);
    require(
      IRole(address(this)).hasRole(validator_role, signatureAddr),
      'Invalid meta-signature'
    );
  }
}
