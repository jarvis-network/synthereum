// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.4;

import {
  ISynthereumAutonomousPoolStorage
} from './interfaces/IAutonomousPoolStorage.sol';
import {ISynthereumAutonomousPool} from './interfaces/IAutonomousPool.sol';
import {
  FixedPoint
} from '@uma/core/contracts/common/implementation/FixedPoint.sol';
import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {IStandardERC20} from '../../base/interfaces/IStandardERC20.sol';
import {
  IMintableBurnableERC20
} from '../../tokens/interfaces/IMintableBurnableERC20.sol';
import {ISynthereumFinder} from '../../core/interfaces/IFinder.sol';
import {
  ISynthereumPriceFeed
} from '../../oracle/common/interfaces/IPriceFeed.sol';
import {SynthereumInterfaces} from '../../core/Constants.sol';
import {
  SafeERC20
} from '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';

/**
 * @notice Pool implementation is stored here to reduce deployment costs
 */

library SynthereumAutonomousPoolLib {
  using FixedPoint for FixedPoint.Unsigned;
  using FixedPoint for uint256;
  using SafeERC20 for IERC20;
  using SafeERC20 for IMintableBurnableERC20;
  using SynthereumAutonomousPoolLib for ISynthereumAutonomousPoolStorage.Storage;
  using SynthereumAutonomousPoolLib for ISynthereumAutonomousPoolStorage.LPPosition;
  using SynthereumAutonomousPoolLib for ISynthereumAutonomousPoolStorage.FeeStatus;

  struct ExecuteMintParams {
    // Amount of synth tokens to mint
    FixedPoint.Unsigned numTokens;
    // Amount of collateral (excluding fees) needed for mint
    FixedPoint.Unsigned collateralAmount;
    // Amount of fees of collateral user must pay
    FixedPoint.Unsigned feeAmount;
    // Amount of collateral equal to collateral minted + fees
    FixedPoint.Unsigned totCollateralAmount;
    // Recipient address that will receive synthetic tokens
    address recipient;
  }

  struct ExecuteRedeemParams {
    //Amount of synth tokens needed for redeem
    FixedPoint.Unsigned numTokens;
    // Amount of collateral that user will receive
    FixedPoint.Unsigned collateralAmount;
    // Amount of fees of collateral user must pay
    FixedPoint.Unsigned feeAmount;
    // Amount of collateral equal to collateral redeemed + fees
    FixedPoint.Unsigned totCollateralAmount;
    // Recipient address that will receive synthetic tokens
    address recipient;
  }

  //----------------------------------------
  // Events
  //----------------------------------------

  event Mint(
    address indexed account,
    address indexed pool,
    uint256 collateralSent,
    uint256 numTokensReceived,
    uint256 feePaid,
    address recipient
  );

  event Redeem(
    address indexed account,
    address indexed pool,
    uint256 numTokensSent,
    uint256 collateralReceived,
    uint256 feePaid,
    address recipient
  );

  event SetFeePercentage(uint256 feePercentage);

  event SetFeeRecipients(address[] feeRecipients, uint32[] feeProportions);

  //----------------------------------------
  // External function
  //----------------------------------------

  /**
   * @notice Initializes a fresh on chain pool
   * @notice `_overCollateralization should be greater than 0
   * @param self Data type the library is attached to
   * @param _finder The Synthereum finder
   * @param _version Synthereum version
   * @param _collateralToken ERC20 collateral token
   * @param _syntheticToken ERC20 synthetic token
   * @param _overCollateralization Over-collateralization ratio
   * @param _priceIdentifier Identifier of price to be used in the price feed
   */
  function initialize(
    ISynthereumAutonomousPoolStorage.Storage storage self,
    ISynthereumFinder _finder,
    uint8 _version,
    IERC20 _collateralToken,
    IMintableBurnableERC20 _syntheticToken,
    FixedPoint.Unsigned memory _overCollateralization,
    bytes32 _priceIdentifier
  ) external {
    require(
      _overCollateralization.isGreaterThan(0),
      'Overcollateralization must be bigger than 0'
    );
    self.finder = _finder;
    self.version = _version;
    self.collateralToken = _collateralToken;
    self.syntheticToken = _syntheticToken;
    self.overCollateralization = _overCollateralization;
    self.priceIdentifier = _priceIdentifier;
  }

  /**
   * @notice Mint synthetic tokens using fixed amount of collateral
   * @notice This calculate the price using on chain price feed
   * @notice User must approve collateral transfer for the mint request to succeed
   * @param self Data type the library is attached to
   * @param lpPosition Position of the LP (see LPPosition struct)
   * @param feeStatus Actual status of fee gained (see FeeStatus struct)
   * @param mintParams Input parameters for minting (see MintParams struct)
   * @return syntheticTokensMinted Amount of synthetic tokens minted by a user
   * @return feePaid Amount of collateral paid by the user as fee
   */
  function mint(
    ISynthereumAutonomousPoolStorage.Storage storage self,
    ISynthereumAutonomousPoolStorage.LPPosition storage lpPosition,
    ISynthereumAutonomousPoolStorage.FeeStatus storage feeStatus,
    ISynthereumAutonomousPool.MintParams memory mintParams
  ) external returns (uint256 syntheticTokensMinted, uint256 feePaid) {
    FixedPoint.Unsigned memory totCollateralAmount =
      FixedPoint.Unsigned(mintParams.collateralAmount);
    FixedPoint.Unsigned memory feeAmount =
      totCollateralAmount.mul(self.fee.feePercentage);
    FixedPoint.Unsigned memory collateralAmount =
      totCollateralAmount.sub(feeAmount);
    FixedPoint.Unsigned memory numTokens =
      calculateNumberOfTokens(
        self.finder,
        IStandardERC20(address(self.collateralToken)),
        self.priceIdentifier,
        collateralAmount
      );
    require(
      numTokens.isGreaterThanOrEqual(mintParams.minNumTokens),
      'Number of tokens less than minimum limit'
    );
    checkParams(self, mintParams.feePercentage, mintParams.expiration);
    self.executeMint(
      lpPosition,
      feeStatus,
      ExecuteMintParams(
        numTokens,
        collateralAmount,
        feeAmount,
        totCollateralAmount,
        mintParams.recipient
      )
    );
    syntheticTokensMinted = numTokens.rawValue;
    feePaid = feeAmount.rawValue;
  }

  /**
   * @notice Redeem amount of collateral using fixed number of synthetic token
   * @notice This calculate the price using on chain price feed
   * @notice User must approve synthetic token transfer for the redeem request to succeed
   * @param self Data type the library is attached to
   * @param lpPosition Position of the LP (see LPPosition struct)
   * @param feeStatus Actual status of fee gained (see FeeStatus struct)
   * @param redeemParams Input parameters for redeeming (see RedeemParams struct)
   * @return collateralRedeemed Amount of collateral redeeem by user
   * @return feePaid Amount of collateral paid by user as fee
   */
  function redeem(
    ISynthereumAutonomousPoolStorage.Storage storage self,
    ISynthereumAutonomousPoolStorage.LPPosition storage lpPosition,
    ISynthereumAutonomousPoolStorage.FeeStatus storage feeStatus,
    ISynthereumAutonomousPool.RedeemParams memory redeemParams
  ) external returns (uint256 collateralRedeemed, uint256 feePaid) {
    FixedPoint.Unsigned memory numTokens =
      FixedPoint.Unsigned(redeemParams.numTokens);
    FixedPoint.Unsigned memory totCollateralAmount =
      calculateCollateralAmount(
        self.finder,
        IStandardERC20(address(self.collateralToken)),
        self.priceIdentifier,
        numTokens
      );
    FixedPoint.Unsigned memory feeAmount =
      totCollateralAmount.mul(self.fee.feePercentage);
    FixedPoint.Unsigned memory collateralAmount =
      totCollateralAmount.sub(feeAmount);
    require(
      collateralAmount.isGreaterThanOrEqual(redeemParams.minCollateral),
      'Collateral amount less than minimum limit'
    );
    checkParams(self, redeemParams.feePercentage, redeemParams.expiration);
    self.executeRedeem(
      lpPosition,
      feeStatus,
      ExecuteRedeemParams(
        numTokens,
        collateralAmount,
        feeAmount,
        totCollateralAmount,
        redeemParams.recipient
      )
    );
    feePaid = feeAmount.rawValue;
    collateralRedeemed = collateralAmount.rawValue;
  }

  /**
   * @notice Update the fee percentage
   * @param self Data type the library is attached to
   * @param _feePercentage The new fee percentage
   */
  function setFeePercentage(
    ISynthereumAutonomousPoolStorage.Storage storage self,
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
    ISynthereumAutonomousPoolStorage.Storage storage self,
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
    self.fee.totalFeeProportions = totalActualFeeProportions;
    emit SetFeeRecipients(_feeRecipients, _feeProportions);
  }

  //----------------------------------------
  //  Internal functions
  //----------------------------------------

  /**
   * @notice Execute mint of synthetic tokens
   * @param self Data type the library is attached to
   * @param lpPosition Position of the LP (see LPPosition struct)
   * @param feeStatus Actual status of fee gained (see FeeStatus struct)
   * @param executeMintParams Params for execution of mint (see ExecuteMintParams struct)
   */
  function executeMint(
    ISynthereumAutonomousPoolStorage.Storage storage self,
    ISynthereumAutonomousPoolStorage.LPPosition storage lpPosition,
    ISynthereumAutonomousPoolStorage.FeeStatus storage feeStatus,
    ExecuteMintParams memory executeMintParams
  ) internal {
    // Sending amount must be different from 0
    require(
      executeMintParams.collateralAmount.isGreaterThan(0),
      'Sending amount is equal to 0'
    );

    // Collateral available
    FixedPoint.Unsigned memory unusedCollateral =
      self.collateralToken.balanceOf(address(this)).sub(
        lpPosition.totalCollateralAmount.add(feeStatus.totalFeeAmount)
      );

    // Update LP's collateralization status
    FixedPoint.Unsigned memory overCollateral =
      lpPosition.updateLpPositionInMint(
        self.overCollateralization,
        executeMintParams.collateralAmount,
        executeMintParams.numTokens
      );

    //Check there is enough liquidity in the pool for overcollateralization
    require(
      unusedCollateral.isGreaterThanOrEqual(overCollateral),
      'No enough liquidity for cover mint operation'
    );

    // Update fees status
    feeStatus.updateFees(self.fee, executeMintParams.feeAmount);

    // Pull user's collateral and mint fee into the pool
    self.pullCollateral(msg.sender, executeMintParams.totCollateralAmount);

    // Mint synthetic asset and transfer to the recipient
    self.syntheticToken.mint(
      executeMintParams.recipient,
      executeMintParams.numTokens.rawValue
    );

    emit Mint(
      msg.sender,
      address(this),
      executeMintParams.totCollateralAmount.rawValue,
      executeMintParams.numTokens.rawValue,
      executeMintParams.feeAmount.rawValue,
      executeMintParams.recipient
    );
  }

  /**
   * @notice Execute redeem of collateral
   * @param self Data type the library is attached tfo
   * @param lpPosition Position of the LP (see LPPosition struct)
   * @param feeStatus Actual status of fee gained (see FeeStatus struct)
   * @param executeRedeemParams Params for execution of redeem (see ExecuteRedeemParams struct)
   */
  function executeRedeem(
    ISynthereumAutonomousPoolStorage.Storage storage self,
    ISynthereumAutonomousPoolStorage.LPPosition storage lpPosition,
    ISynthereumAutonomousPoolStorage.FeeStatus storage feeStatus,
    ExecuteRedeemParams memory executeRedeemParams
  ) internal {
    // Sending amount must be different from 0
    require(
      executeRedeemParams.numTokens.isGreaterThan(0),
      'Sending amount is equal to 0'
    );

    FixedPoint.Unsigned memory collateralRedeemed =
      lpPosition.updateLpPositionInRedeem(executeRedeemParams.numTokens);

    // Check that collateral redemeed is enough for cover the value of synthetic tokens
    require(
      collateralRedeemed.isGreaterThanOrEqual(
        executeRedeemParams.totCollateralAmount
      ),
      'Position undercapitalized'
    );

    // Update fees status
    feeStatus.updateFees(self.fee, executeRedeemParams.feeAmount);

    IMintableBurnableERC20 synthToken = self.syntheticToken;

    // Transfer synthetic token from the user to the pool
    synthToken.safeTransferFrom(
      msg.sender,
      address(this),
      executeRedeemParams.numTokens.rawValue
    );

    // Burn synthetic asset
    synthToken.burn(executeRedeemParams.numTokens.rawValue);

    //Send net amount of collateral to the user that submited the redeem request
    self.collateralToken.safeTransfer(
      executeRedeemParams.recipient,
      executeRedeemParams.collateralAmount.rawValue
    );

    emit Redeem(
      msg.sender,
      address(this),
      executeRedeemParams.numTokens.rawValue,
      executeRedeemParams.collateralAmount.rawValue,
      executeRedeemParams.feeAmount.rawValue,
      executeRedeemParams.recipient
    );
  }

  /**
   * @notice Update LP's collateralization status after a mint
   * @param lpPosition Position of the LP (see LPPosition struct)
   * @param overCollateralization Overcollateralization rate
   * @param collateralAmount Collateral amount to be added (only user collateral)
   * @param numTokens Tokens to be added
   * @return overCollateral Amount of collateral to be provided by LP for overcollateralization
   */
  function updateLpPositionInMint(
    ISynthereumAutonomousPoolStorage.LPPosition storage lpPosition,
    FixedPoint.Unsigned storage overCollateralization,
    FixedPoint.Unsigned memory collateralAmount,
    FixedPoint.Unsigned memory numTokens
  ) internal returns (FixedPoint.Unsigned memory overCollateral) {
    overCollateral = collateralAmount.mul(overCollateralization);
    lpPosition.totalCollateralAmount = lpPosition
      .totalCollateralAmount
      .add(collateralAmount)
      .add(overCollateral);
    lpPosition.tokenCollateralised = lpPosition.tokenCollateralised.add(
      numTokens
    );
  }

  /**
   * @notice Update LP's collateralization status after a redeem
   * @param lpPosition Position of the LP (see LPPosition struct)
   * @param numTokens Tokens to be removed
   * @return collateralRedeemed Collateral redeemed
   */
  function updateLpPositionInRedeem(
    ISynthereumAutonomousPoolStorage.LPPosition storage lpPosition,
    FixedPoint.Unsigned memory numTokens
  ) internal returns (FixedPoint.Unsigned memory collateralRedeemed) {
    FixedPoint.Unsigned memory totalActualTokens =
      lpPosition.tokenCollateralised;
    FixedPoint.Unsigned memory totalActualCollateral =
      lpPosition.totalCollateralAmount;
    FixedPoint.Unsigned memory fractionRedeemed =
      numTokens.div(totalActualTokens);
    collateralRedeemed = fractionRedeemed.mul(totalActualCollateral);
    lpPosition.tokenCollateralised = totalActualTokens.sub(numTokens);
    lpPosition.totalCollateralAmount = totalActualCollateral.sub(
      collateralRedeemed
    );
  }

  /**
   * @notice Update fee gained by the fee recipients
   * @param feeStatus Actual status of fee gained to be withdrawn
   * @param feeInfo Actual status of fee recipients and their proportions
   * @param feeAmount Collateral fee charged
   */
  function updateFees(
    ISynthereumAutonomousPoolStorage.FeeStatus storage feeStatus,
    ISynthereumAutonomousPoolStorage.Fee storage feeInfo,
    FixedPoint.Unsigned memory feeAmount
  ) internal {
    FixedPoint.Unsigned memory feeCharged;
    uint256 numberOfRecipients = feeInfo.feeRecipients.length;
    for (uint256 i = 0; i < numberOfRecipients - 1; i++) {
      address feeRecipient = feeInfo.feeRecipients[i];
      FixedPoint.Unsigned memory feeReceived =
        feeAmount.mul(feeInfo.feeProportions[i]).div(
          feeInfo.totalFeeProportions
        );
      feeStatus.feeGained[feeRecipient] = feeStatus.feeGained[feeRecipient].add(
        feeReceived
      );
      feeCharged = feeCharged.add(feeReceived);
    }
    address lastRecipient = feeInfo.feeRecipients[numberOfRecipients - 1];
    feeStatus.feeGained[lastRecipient] = feeStatus.feeGained[lastRecipient].add(
      feeAmount.sub(feeCharged)
    );
    feeStatus.totalFeeAmount = feeStatus.totalFeeAmount.add(feeAmount);
  }

  /**
   * @notice Pulls collateral tokens from the sender to store in the Pool
   * @param self Data type the library is attached to
   * @param numTokens The number of tokens to pull
   */
  function pullCollateral(
    ISynthereumAutonomousPoolStorage.Storage storage self,
    address from,
    FixedPoint.Unsigned memory numTokens
  ) internal {
    self.collateralToken.safeTransferFrom(
      from,
      address(this),
      numTokens.rawValue
    );
  }

  //----------------------------------------
  //  Internal views functions
  //----------------------------------------

  /**
   * @notice Check fee percentage and expiration of mint, redeem and exchange transaction
   * @param self Data type the library is attached tfo
   * @param feePercentage Maximum percentage of fee that a user want to pay
   * @param expiration Expiration time of the transaction
   */
  function checkParams(
    ISynthereumAutonomousPoolStorage.Storage storage self,
    uint256 feePercentage,
    uint256 expiration
  ) internal view {
    require(block.timestamp <= expiration, 'Transaction expired');
    require(
      self.fee.feePercentage.rawValue <= feePercentage,
      'User fee percentage less than actual one'
    );
  }

  /**
   * @notice Calculate synthetic token amount starting from an amount of collateral, using on-chain oracle
   * @param finder Synthereum finder
   * @param collateralToken Collateral token contract
   * @param priceIdentifier Identifier of price pair
   * @param numTokens Amount of collateral from which you want to calculate synthetic token amount
   * @return numTokens Amount of tokens after on-chain oracle conversion
   */
  function calculateNumberOfTokens(
    ISynthereumFinder finder,
    IStandardERC20 collateralToken,
    bytes32 priceIdentifier,
    FixedPoint.Unsigned memory collateralAmount
  ) internal view returns (FixedPoint.Unsigned memory numTokens) {
    FixedPoint.Unsigned memory priceRate =
      getPriceFeedRate(finder, priceIdentifier);
    uint256 decimalsOfCollateral = getCollateralDecimals(collateralToken);
    numTokens = collateralAmount.mul(10**(18 - decimalsOfCollateral)).div(
      priceRate
    );
  }

  /**
   * @notice Calculate collateral amount starting from an amount of synthtic token, using on-chain oracle
   * @param finder Synthereum finder
   * @param collateralToken Collateral token contract
   * @param priceIdentifier Identifier of price pair
   * @param numTokens Amount of synthetic tokens from which you want to calculate collateral amount
   * @return collateralAmount Amount of collateral after on-chain oracle conversion
   */
  function calculateCollateralAmount(
    ISynthereumFinder finder,
    IStandardERC20 collateralToken,
    bytes32 priceIdentifier,
    FixedPoint.Unsigned memory numTokens
  ) internal view returns (FixedPoint.Unsigned memory collateralAmount) {
    FixedPoint.Unsigned memory priceRate =
      getPriceFeedRate(finder, priceIdentifier);
    uint256 decimalsOfCollateral = getCollateralDecimals(collateralToken);
    collateralAmount = numTokens.mul(priceRate).div(
      10**(18 - decimalsOfCollateral)
    );
  }

  /**
   * @notice Retrun the on-chain oracle price for a pair
   * @param finder Synthereum finder
   * @param priceIdentifier Identifier of price pair
   * @return priceRate Latest rate of the pair
   */
  function getPriceFeedRate(ISynthereumFinder finder, bytes32 priceIdentifier)
    internal
    view
    returns (FixedPoint.Unsigned memory priceRate)
  {
    ISynthereumPriceFeed priceFeed =
      ISynthereumPriceFeed(
        finder.getImplementationAddress(SynthereumInterfaces.PriceFeed)
      );
    priceRate = FixedPoint.Unsigned(priceFeed.getLatestPrice(priceIdentifier));
  }

  /**
   * @notice Retrun the number of decimals of collateral token
   * @param collateralToken Collateral token contract
   * @return decimals number of decimals
   */
  function getCollateralDecimals(IStandardERC20 collateralToken)
    internal
    view
    returns (uint256 decimals)
  {
    decimals = collateralToken.decimals();
  }
}
