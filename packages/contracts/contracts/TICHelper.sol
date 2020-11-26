pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import {TIC} from './TIC.sol';
import {TICInterface} from './TICInterface.sol';

import {SafeMath} from '@openzeppelin/contracts/math/SafeMath.sol';
import {FixedPoint} from '@jarvis-network/uma-core/contracts/common/implementation/FixedPoint.sol';
import {HitchensUnorderedKeySetLib} from './HitchensUnorderedKeySet.sol';
import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {IExpiringMultiParty} from './IExpiringMultiParty.sol';

/**
 * @notice TIC implementation is stored here to reduce deployment costs
 * @dev Before refactoring implementation into a library, deploying TICs exceeded gas limits
 */
library TICHelper {
  //----------------------------------------
  // Type definitions
  //----------------------------------------

  using SafeMath for uint256;
  using FixedPoint for FixedPoint.Unsigned;
  using HitchensUnorderedKeySetLib for HitchensUnorderedKeySetLib.Set;
  using TICHelper for TIC.Storage;

  //----------------------------------------
  // Public functions
  //----------------------------------------

  /**
   * @notice Initializes a fresh TIC
   * @notice The derivative's margin currency must be a RToken
   * @notice The validator will generally be an address owned by the LP
   * @notice `_startingCollateralization should be greater than the expected asset price multiplied
   *      by the collateral requirement. The degree to which it is greater should be based on
   *      the expected asset volatility.
   * @param self Data type the library is attached to
   * @param _derivative The `ExpiringMultiParty`
   * @param _liquidityProvider The liquidity provider
   * @param _validator The address that validates mint and exchange requests
   * @param _startingCollateralization Collateralization ratio to use before a global one is set
   */
  function initialize(
    TIC.Storage storage self,
    IExpiringMultiParty _derivative,
    address _liquidityProvider,
    address _validator,
    FixedPoint.Unsigned memory _startingCollateralization
  ) public {
    self.derivative = _derivative;
    self.liquidityProvider = _liquidityProvider;
    self.validator = _validator;
    self.startingCollateralization = _startingCollateralization;
    self.collateralToken = IERC20(
      address(self.derivative.collateralCurrency())
    );
  }

  /**
   * @notice Submit a request to mint tokens
   * @notice The request needs to approved by the LP before tokens are created. This is
   *         necessary to prevent users from abusing LPs by minting large amounts of tokens
   *         with little collateral.
   * @notice User must approve collateral transfer for the mint request to succeed
   * @param self Data type the library is attached to
   * @param collateralAmount The amount of collateral supplied
   * @param numTokens The number of tokens the user wants to mint
   * @return The mint request ID
   * TODO: A sponsor could theoretically circumvent the TIC and mint tokens with an extremely
   *       high collateralization ratio at any point in time, preventing users from minting
   *       tokens with the available LP collateral.
   * TODO: A sponsor could theoretically circumvent the TIC and mint tokens with an extremely
   *       low collateralization ratio if they are the derivative's first sponsor, mint tokens
   *       at that ratio through the TIC, forcing the TIC to take on an undercollateralized
   *       position, then liquidate the TIC.
   * TODO: Make sure a user cannot mint a ton of tokens with little collateral and force
           the LP to provide all the extra.
   */
  function mintRequest(
    TIC.Storage storage self,
    FixedPoint.Unsigned memory collateralAmount,
    FixedPoint.Unsigned memory numTokens
  ) public returns (bytes32) {
    bytes32 mintID =
      keccak256(
        abi.encodePacked(
          msg.sender,
          collateralAmount.rawValue,
          numTokens.rawValue,
          now
        )
      );

    TICInterface.MintRequest memory mint =
      TICInterface.MintRequest(
        mintID,
        now,
        msg.sender,
        collateralAmount,
        numTokens
      );

    self.mintRequestSet.insert(mintID);
    self.mintRequests[mintID] = mint;

    return mintID;
  }

  /**
   * @notice Approve a mint request as an LP
   * @notice This will typically be done with a keeper bot
   * @notice User needs to have approved the transfer of collateral tokens
   * @param self Data type the library is attached to
   * @param mintID The ID of the mint request
   */
  function approveMint(TIC.Storage storage self, bytes32 mintID) public {
    FixedPoint.Unsigned memory globalCollateralization =
      self.getGlobalCollateralizationRatio();

    // Target the starting collateralization ratio if there is no global ratio
    FixedPoint.Unsigned memory targetCollateralization =
      globalCollateralization.isGreaterThan(0)
        ? globalCollateralization
        : self.startingCollateralization;

    require(self.mintRequestSet.exists(mintID), 'Mint request does not exist');
    TICInterface.MintRequest memory mint = self.mintRequests[mintID];

    // Check that LP collateral can support the tokens to be minted
    require(
      self.checkCollateralizationRatio(
        targetCollateralization,
        mint.collateralAmount,
        mint.numTokens
      ),
      'Insufficient collateral available from Liquidity Provider'
    );

    // Remove mint request
    self.mintRequestSet.remove(mintID);
    delete self.mintRequests[mintID];

    // Calculate fees
    FixedPoint.Unsigned memory feeTotal =
      mint.collateralAmount.mul(self.fee.feePercentage);

    // Pull user's collateral and mint fee into the TIC
    self.pullCollateral(mint.sender, mint.collateralAmount.add(feeTotal));

    // Mint synthetic asset with margin from user and provider
    self.mintSynTokens(
      mint.numTokens.mulCeil(targetCollateralization),
      mint.numTokens
    );

    // Transfer synthetic asset to the user
    self.transferSynTokens(mint.sender, mint.numTokens);

    self.sendFee(feeTotal);
  }

  /**
   * @notice Reject a mint request as an LP
   * @notice This will typically be done with a keeper bot
   * @param self Data type the library is attached to
   * @param mintID The ID of the mint request
   */
  function rejectMint(TIC.Storage storage self, bytes32 mintID) public {
    require(self.mintRequestSet.exists(mintID), 'Mint request does not exist');
    self.mintRequestSet.remove(mintID);
    delete self.mintRequests[mintID];
  }

  /**
   * @notice Liquidity provider supplies margin to the TIC to collateralize user deposits
   * @param self Data type the library is attached to
   * @param collateralAmount The amount of margin supplied
   */
  function deposit(
    TIC.Storage storage self,
    FixedPoint.Unsigned memory collateralAmount
  ) public {
    // Pull LP's collateral into the TIC
    self.pullCollateral(msg.sender, collateralAmount);
  }

  /**
   * @notice Liquidity provider withdraw margin from the TIC
   * @param self Data type the library is attached to
   * @param collateralAmount The amount of margin to withdraw
   */
  function withdraw(
    TIC.Storage storage self,
    FixedPoint.Unsigned memory collateralAmount
  ) public {
    // Redeem the RToken collateral for the underlying and transfer to the user
    require(
      self.collateralToken.transfer(msg.sender, collateralAmount.rawValue)
    );
  }

  /**
   * @notice Called by a source TIC's `exchange` function to mint destination tokens
   * @dev This function could be called by any account to mint tokens, however they will lose
   *      their excess collateral to the liquidity provider when they redeem the tokens.
   * @param self Data type the library is attached to
   * @param collateralAmount The amount of collateral to use from the source TIC
   * @param numTokens The number of new tokens to mint
   */
  function exchangeMint(
    TIC.Storage storage self,
    FixedPoint.Unsigned memory collateralAmount,
    FixedPoint.Unsigned memory numTokens
  ) public {
    FixedPoint.Unsigned memory globalCollateralization =
      self.getGlobalCollateralizationRatio();

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

    // Pull RToken collateral from calling TIC contract
    require(self.pullCollateral(msg.sender, collateralAmount));

    // Mint new tokens with the collateral
    self.mintSynTokens(numTokens.mulCeil(targetCollateralization), numTokens);

    // Transfer new tokens back to the calling TIC where they will be sent to the user
    self.transferSynTokens(msg.sender, numTokens);
  }

  /**
   * @notice Move collateral from TIC to its derivative in order to increase GCR
   * @param self Data type the library is attached to
   * @param collateralAmount The amount of collateral to move into derivative
   */
  function depositIntoDerivative(
    TIC.Storage storage self,
    FixedPoint.Unsigned memory collateralAmount
  ) public {
    IExpiringMultiParty derivative = self.derivative;
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
   * @param collateralAmount The amount of short margin to withdraw
   */
  function withdrawRequest(
    TIC.Storage storage self,
    FixedPoint.Unsigned memory collateralAmount
  ) public {
    self.derivative.requestWithdrawal(collateralAmount);
  }

  /**
   * @notice Withdraw collateral after a withdraw request has passed it's liveness period
   * TODO: `derivative.withdrawPassedRequest` gets an `amountWithdrawn` return value in commit
   *       86d8ffcd694bbed40140dede179692e7036f2996
   */
  function withdrawPassedRequest(TIC.Storage storage self) public {
    uint256 prevBalance = self.collateralToken.balanceOf(address(this));

    // TODO: This will return the amount withdrawn after commit
    //       86d8ffcd694bbed40140dede179692e7036f2996
    self.derivative.withdrawPassedRequest();

    FixedPoint.Unsigned memory amountWithdrawn =
      FixedPoint.Unsigned(
        self.collateralToken.balanceOf(address(this)).sub(prevBalance)
      );
    require(amountWithdrawn.isGreaterThan(0), 'No tokens were redeemed');
    require(
      self.collateralToken.transfer(msg.sender, amountWithdrawn.rawValue)
    );
  }

  /**
   * @notice Submit a request to redeem tokens
   * @notice The request needs to approved by the LP before tokens are created. This is
   *         necessary to prevent users from abusing LPs by redeeming large amounts of collateral
   *         from a small number of tokens.
   * @notice User must approve synthetic token transfer for the redeem request to succeed
   * @param collateralAmount The amount of collateral to redeem tokens for
   * @param numTokens The number of tokens to redeem
   * @return The redeem request ID
   */
  function redeemRequest(
    TIC.Storage storage self,
    FixedPoint.Unsigned memory collateralAmount,
    FixedPoint.Unsigned memory numTokens
  ) public returns (bytes32) {
    bytes32 redeemID =
      keccak256(
        abi.encodePacked(
          msg.sender,
          collateralAmount.rawValue,
          numTokens.rawValue,
          now
        )
      );

    TICInterface.RedeemRequest memory redeem =
      TICInterface.RedeemRequest(
        redeemID,
        now,
        msg.sender,
        collateralAmount,
        numTokens
      );

    self.redeemRequestSet.insert(redeemID);
    self.redeemRequests[redeemID] = redeem;

    return redeemID;
  }

  /**
   * @notice Approve a redeem request as an LP
   * @notice This will typically be done with a keeper bot
   * @notice User needs to have approved the transfer of synthetic tokens
   * @param redeemID The ID of the redeem request
   */
  function approveRedeem(TIC.Storage storage self, bytes32 redeemID) public {
    require(
      self.redeemRequestSet.exists(redeemID),
      'Redeem request does not exist'
    );
    TICInterface.RedeemRequest memory redeem = self.redeemRequests[redeemID];

    require(redeem.numTokens.isGreaterThan(0));

    IERC20 tokenCurrency = self.derivative.tokenCurrency();
    require(
      tokenCurrency.balanceOf(redeem.sender) >= redeem.numTokens.rawValue
    );

    // Remove redeem request
    self.redeemRequestSet.remove(redeemID);
    delete self.redeemRequests[redeemID];

    // Move synthetic tokens from the user to the TIC
    // - This is because derivative expects the tokens to come from the sponsor address
    require(
      tokenCurrency.transferFrom(
        redeem.sender,
        address(this),
        redeem.numTokens.rawValue
      ),
      'Token transfer failed'
    );

    // Allow the derivative to transfer tokens from the TIC
    require(
      tokenCurrency.approve(
        address(self.derivative),
        redeem.numTokens.rawValue
      ),
      'Token approve failed'
    );

    uint256 prevBalance = self.collateralToken.balanceOf(address(this));

    // Redeem the synthetic tokens for RToken collateral
    self.derivative.redeem(redeem.numTokens);

    FixedPoint.Unsigned memory amountWithdrawn =
      FixedPoint.Unsigned(
        self.collateralToken.balanceOf(address(this)).sub(prevBalance)
      );

    require(amountWithdrawn.isGreaterThan(redeem.collateralAmount));

    // Calculate fees
    FixedPoint.Unsigned memory feeTotal =
      redeem.collateralAmount.mul(self.fee.feePercentage);

    //Send net amount of dai to the user that submit redeem request
    self.collateralToken.transfer(
      redeem.sender,
      redeem.collateralAmount.sub(feeTotal).rawValue
    );

    self.sendFee(feeTotal);
  }

  /**
   * @notice Reject a redeem request as an LP
   * @notice This will typically be done with a keeper bot
   * @param redeemID The ID of the redeem request
   */
  function rejectRedeem(TIC.Storage storage self, bytes32 redeemID) public {
    require(
      self.redeemRequestSet.exists(redeemID),
      'Mint request does not exist'
    );
    self.redeemRequestSet.remove(redeemID);
    delete self.redeemRequests[redeemID];
  }

  /**
   * @notice Redeem tokens after contract expiry
   * @notice After derivative expiry, an LP should use this instead of `withdrawRequest` to
   *         retrieve their collateral.
   * TODO: `derivative.settleExpired` gets an `amountWithdrawn` return value in commit
   *       86d8ffcd694bbed40140dede179692e7036f2996
   * TODO: Revert function if DVM does not have a price available
   */
  function settleExpired(TIC.Storage storage self) public {
    IERC20 tokenCurrency = self.derivative.tokenCurrency();

    FixedPoint.Unsigned memory numTokens =
      FixedPoint.Unsigned(tokenCurrency.balanceOf(msg.sender));

    // Make sure there is something for the user to settle
    require(
      numTokens.isGreaterThan(0) || msg.sender == self.liquidityProvider,
      'Account has nothing to settle'
    );

    if (numTokens.isGreaterThan(0)) {
      // Move synthetic tokens from the user to the TIC
      // - This is because derivative expects the tokens to come from the sponsor address
      require(
        tokenCurrency.transferFrom(
          msg.sender,
          address(this),
          numTokens.rawValue
        ),
        'Token transfer failed'
      );

      // Allow the derivative to transfer tokens from the TIC
      require(
        tokenCurrency.approve(address(self.derivative), numTokens.rawValue),
        'Token approve failed'
      );
    }

    uint256 prevBalance = self.collateralToken.balanceOf(address(this));

    // Redeem the synthetic tokens for RToken collateral
    // TODO: This will return the amount withdrawn after commit
    //       86d8ffcd694bbed40140dede179692e7036f2996
    self.derivative.settleExpired();

    FixedPoint.Unsigned memory amountWithdrawn =
      FixedPoint.Unsigned(
        self.collateralToken.balanceOf(address(this)).sub(prevBalance)
      );
    // TODO: May need to allow LPs to continue despite noting being withdrawn
    require(amountWithdrawn.isGreaterThan(0), 'No collateral was withdrawn');

    // Amount of RToken collateral that will be redeemed and sent to the user
    FixedPoint.Unsigned memory totalToRedeem;

    // If the user is the LP, send redeemed token collateral plus excess collateral
    if (msg.sender == self.liquidityProvider) {
      // Redeem LP collateral held in TIC pool
      // Includes excess collateral withdrawn by a user previously calling `settleExpired`
      totalToRedeem = FixedPoint.Unsigned(
        self.collateralToken.balanceOf(address(this))
      );
    } else {
      // Otherwise, separate excess collateral from redeemed token value
      // Must be called after `derivative.settleExpired` to make sure expiryPrice is set
      totalToRedeem = numTokens.mul(
        FixedPoint.Unsigned(self.derivative.expiryPrice())
      );
      require(
        amountWithdrawn.isGreaterThanOrEqual(totalToRedeem),
        'Insufficient collateral withdrawn to redeem tokens'
      );
    }

    // Redeem the RToken collateral for the underlying and transfer to the user
    require(self.collateralToken.transfer(msg.sender, totalToRedeem.rawValue));
  }

  /**
   * @notice Submit a request to perform an atomic of tokens between TICs
   * @dev The number of destination tokens needs to be calculated relative to the value of the
   *      source tokens and the destination's collateral ratio. If too many destination tokens
   *      are requested the transaction will fail.
   * @param self Data type the library is attached to
   * @param destTIC The destination TIC
   * @param numTokens The number of source tokens to swap
   * @param collateralAmount Collateral amount equivalent to numTokens and destNumTokens
   * @param destNumTokens The number of destination tokens the swap attempts to procure
   * @return The exchange request ID
   */
  function exchangeRequest(
    TIC.Storage storage self,
    TICInterface destTIC,
    FixedPoint.Unsigned memory numTokens,
    FixedPoint.Unsigned memory collateralAmount,
    FixedPoint.Unsigned memory destNumTokens
  ) public returns (bytes32) {
    bytes32 exchangeID =
      keccak256(
        abi.encodePacked(
          msg.sender,
          address(destTIC),
          numTokens.rawValue,
          destNumTokens.rawValue,
          now
        )
      );

    TICInterface.ExchangeRequest memory exchange =
      TICInterface.ExchangeRequest(
        exchangeID,
        now,
        msg.sender,
        destTIC,
        numTokens,
        collateralAmount,
        destNumTokens
      );

    self.exchangeRequestSet.insert(exchangeID);
    self.exchangeRequests[exchangeID] = exchange;

    return exchangeID;
  }

  /**
   * @notice Approve an exchange request
   * @notice This will typically be done with a keeper bot
   * @notice User needs to have approved the transfer of synthetic tokens
   * @param exchangeID The ID of the exchange request
   */
  function approveExchange(TIC.Storage storage self, bytes32 exchangeID)
    public
  {
    require(
      self.exchangeRequestSet.exists(exchangeID),
      'Exchange request does not exist'
    );
    TICInterface.ExchangeRequest memory exchange =
      self.exchangeRequests[exchangeID];

    self.exchangeRequestSet.remove(exchangeID);
    delete self.exchangeRequests[exchangeID];

    uint256 prevBalance = self.collateralToken.balanceOf(address(this));

    // Burn the source tokens to get collateral
    // TODO: This will be able to return the amount withdrawn after commit
    //       86d8ffcd694bbed40140dede179692e7036f2996
    self.redeemForCollateral(exchange.sender, exchange.numTokens);

    FixedPoint.Unsigned memory amountWithdrawn =
      FixedPoint.Unsigned(
        self.collateralToken.balanceOf(address(this)).sub(prevBalance)
      );

    require(
      amountWithdrawn.isGreaterThan(exchange.collateralAmount),
      'No tokens were redeemed'
    );

    // Calculate fees
    FixedPoint.Unsigned memory feeTotal =
      exchange.collateralAmount.mul(self.fee.feePercentage);

    self.sendFee(feeTotal);

    FixedPoint.Unsigned memory destinationCollateral =
      amountWithdrawn.sub(feeTotal);

    require(
      self.collateralToken.approve(
        address(exchange.destTIC),
        destinationCollateral.rawValue
      )
    );

    // Mint the destination tokens with the withdrawn collateral
    exchange.destTIC.exchangeMint(
      destinationCollateral.rawValue,
      exchange.destNumTokens.rawValue
    );

    // Transfer the new tokens to the user
    require(
      exchange.destTIC.derivative().tokenCurrency().transfer(
        exchange.sender,
        exchange.destNumTokens.rawValue
      )
    );
  }

  /**
   * @notice Reject an exchange request
   * @notice This will typically be done with a keeper bot
   * @param exchangeID The ID of the exchange request
   */
  function rejectExchange(TIC.Storage storage self, bytes32 exchangeID) public {
    require(
      self.exchangeRequestSet.exists(exchangeID),
      'Exchange request does not exist'
    );
    self.exchangeRequestSet.remove(exchangeID);
    delete self.exchangeRequests[exchangeID];
  }

  /**
   * @notice Update the fee percentage
   * @param self Data type the library is attached to
   * @param _feePercentage The new fee percentage
   */
  function setFeePercentage(
    TIC.Storage storage self,
    FixedPoint.Unsigned memory _feePercentage
  ) public {
    self.fee.feePercentage = _feePercentage;
  }

  /**
   * @notice Update the fee recipients and recipient proportions
   * @param self Data type the library is attached to
   * @param _feeRecipients Array of the new fee recipients
   * @param _feeProportions Array of the new fee recipient proportions
   */
  function setFeeRecipients(
    TIC.Storage storage self,
    address[] memory _feeRecipients,
    uint32[] memory _feeProportions
  ) public {
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
  }

  //----------------------------------------
  // Public views
  //----------------------------------------

  /**
   * @notice Get all open mint requests
   * @return An array of mint requests
   */
  function getMintRequests(TIC.Storage storage self)
    public
    view
    returns (TICInterface.MintRequest[] memory)
  {
    TICInterface.MintRequest[] memory mintRequests =
      new TICInterface.MintRequest[](self.mintRequestSet.count());

    for (uint256 i = 0; i < self.mintRequestSet.count(); i++) {
      mintRequests[i] = self.mintRequests[self.mintRequestSet.keyAtIndex(i)];
    }

    return mintRequests;
  }

  /**
   * @notice Get all open mint requests
   * @return An array of mint requests
   */
  function getRedeemRequests(TIC.Storage storage self)
    public
    view
    returns (TICInterface.RedeemRequest[] memory)
  {
    TICInterface.RedeemRequest[] memory redeemRequests =
      new TICInterface.RedeemRequest[](self.redeemRequestSet.count());

    for (uint256 i = 0; i < self.redeemRequestSet.count(); i++) {
      redeemRequests[i] = self.redeemRequests[
        self.redeemRequestSet.keyAtIndex(i)
      ];
    }

    return redeemRequests;
  }

  /**
   * @notice Get all open exchange requests
   * @return An array of exchange requests
   */
  function getExchangeRequests(TIC.Storage storage self)
    public
    view
    returns (TICInterface.ExchangeRequest[] memory)
  {
    TICInterface.ExchangeRequest[] memory exchangeRequests =
      new TICInterface.ExchangeRequest[](self.exchangeRequestSet.count());

    for (uint256 i = 0; i < self.exchangeRequestSet.count(); i++) {
      exchangeRequests[i] = self.exchangeRequests[
        self.exchangeRequestSet.keyAtIndex(i)
      ];
    }

    return exchangeRequests;
  }

  //----------------------------------------
  // Internal functions
  //----------------------------------------

  /**
   * @notice Pulls collateral tokens from the sender to store in the TIC
   * @param self Data type the library is attached to
   * @param numTokens The number of tokens to pull
   * @return `true` if the transfer succeeded, otherwise `false`
   */
  function pullCollateral(
    TIC.Storage storage self,
    address from,
    FixedPoint.Unsigned memory numTokens
  ) internal returns (bool) {
    return
      self.collateralToken.transferFrom(
        from,
        address(this),
        numTokens.rawValue
      );
  }

  /**
   * @notice Mints synthetic tokens with the available margin
   * @param self Data type the library is attached to
   * @param collateralAmount The amount of collateral to send
   * @param numTokens The number of tokens to mint
   */
  function mintSynTokens(
    TIC.Storage storage self,
    FixedPoint.Unsigned memory collateralAmount,
    FixedPoint.Unsigned memory numTokens
  ) internal {
    require(
      self.collateralToken.approve(
        address(self.derivative),
        collateralAmount.rawValue
      )
    );
    self.derivative.create(collateralAmount, numTokens);
  }

  /**
   * @notice Transfer synthetic tokens from the derivative to an address
   * @dev Refactored from `mint` to guard against reentrancy
   * @param self Data type the library is attached to
   * @param recipient The address to send the tokens
   * @param numTokens The number of tokens to send
   */
  function transferSynTokens(
    TIC.Storage storage self,
    address recipient,
    FixedPoint.Unsigned memory numTokens
  ) internal {
    require(
      self.derivative.tokenCurrency().transfer(recipient, numTokens.rawValue)
    );
  }

  /**
   * @notice Set the TIC fee structure parameters
   * @param self Data type the library is attached tfo
   * @param _feeAmount Amount of fee to send
   */
  function sendFee(
    TIC.Storage storage self,
    FixedPoint.Unsigned memory _feeAmount
  ) internal {
    // Distribute fees
    // TODO: Consider using the withdrawal pattern for fees
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

  /**
   * @notice Redeem synthetic tokens for collateral from the derivative
   * @param self Data type the library is attached to
   * @param numTokens The number of tokens to redeem
   * TODO: `derivative.redeem` gets an `amountWithdrawn` return value in commit
   *       86d8ffcd694bbed40140dede179692e7036f2996
   */
  function redeemForCollateral(
    TIC.Storage storage self,
    address tokenHolder,
    FixedPoint.Unsigned memory numTokens
  ) internal {
    require(numTokens.isGreaterThan(0));

    IERC20 tokenCurrency = self.derivative.tokenCurrency();
    require(tokenCurrency.balanceOf(tokenHolder) >= numTokens.rawValue);

    // Move synthetic tokens from the user to the TIC
    // - This is because derivative expects the tokens to come from the sponsor address
    require(
      tokenCurrency.transferFrom(
        tokenHolder,
        address(this),
        numTokens.rawValue
      ),
      'Token transfer failed'
    );

    // Allow the derivative to transfer tokens from the TIC
    require(
      tokenCurrency.approve(address(self.derivative), numTokens.rawValue),
      'Token approve failed'
    );

    // Redeem the synthetic tokens for RToken collateral
    self.derivative.redeem(numTokens);
  }

  //----------------------------------------
  //  Internal views
  //----------------------------------------

  /**
   * @notice Get the global collateralization ratio of the derivative
   * @param self Data type the library is attached to
   * @return The collateralization ratio
   */
  function getGlobalCollateralizationRatio(TIC.Storage storage self)
    internal
    view
    returns (FixedPoint.Unsigned memory)
  {
    FixedPoint.Unsigned memory totalTokensOutstanding =
      FixedPoint.Unsigned(self.derivative.totalTokensOutstanding());

    if (totalTokensOutstanding.isGreaterThan(0)) {
      return
        self.derivative.totalPositionCollateral().div(totalTokensOutstanding);
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
    TIC.Storage storage self,
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
}
