// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.4;

import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {IStandardERC20} from '../../../base/interfaces/IStandardERC20.sol';
import {
  IERC20Standard
} from '@uma/core/contracts/common/interfaces/IERC20Standard.sol';
import {
  BaseControlledMintableBurnableERC20
} from '../../../tokens/interfaces/BaseControlledMintableBurnableERC20.sol';
import {
  ISelfMintingController
} from '../common/interfaces/ISelfMintingController.sol';
import {SynthereumInterfaces} from '../../../core/Constants.sol';
import {ISynthereumFinder} from '../../../core/interfaces/IFinder.sol';
import {
  OracleInterface
} from '@uma/core/contracts/oracle/interfaces/OracleInterface.sol';
import {
  OracleInterfaces
} from '@uma/core/contracts/oracle/implementation/Constants.sol';
import {
  FixedPoint
} from '@uma/core/contracts/common/implementation/FixedPoint.sol';
import {SafeMath} from '@openzeppelin/contracts/utils/math/SafeMath.sol';
import {
  SafeERC20
} from '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import {FeePayerPartyLib} from '../../common/FeePayerPartyLib.sol';
import {FeePayerParty} from '../../common/FeePayerParty.sol';
import {
  PerpetualPositionManagerMultiParty
} from './PerpetualPositionManagerMultiParty.sol';
import {
  ISynthereumPriceFeed
} from '../../../oracle/common/interfaces/IPriceFeed.sol';

library PerpetualPositionManagerMultiPartyLib {
  using SafeMath for uint256;
  using FixedPoint for FixedPoint.Unsigned;
  using SafeERC20 for IERC20;
  using SafeERC20 for BaseControlledMintableBurnableERC20;
  using PerpetualPositionManagerMultiPartyLib for PerpetualPositionManagerMultiParty.PositionData;
  using PerpetualPositionManagerMultiPartyLib for PerpetualPositionManagerMultiParty.PositionManagerData;
  using PerpetualPositionManagerMultiPartyLib for FeePayerParty.FeePayerData;
  using PerpetualPositionManagerMultiPartyLib for FixedPoint.Unsigned;
  using FeePayerPartyLib for FixedPoint.Unsigned;

  //----------------------------------------
  // Events
  //----------------------------------------

  event Deposit(address indexed sponsor, uint256 indexed collateralAmount);
  event Withdrawal(address indexed sponsor, uint256 indexed collateralAmount);
  event PositionCreated(
    address indexed sponsor,
    uint256 indexed collateralAmount,
    uint256 indexed tokenAmount,
    uint256 feeAmount
  );
  event NewSponsor(address indexed sponsor);
  event EndedSponsorPosition(address indexed sponsor);
  event Redeem(
    address indexed sponsor,
    uint256 indexed collateralAmount,
    uint256 indexed tokenAmount,
    uint256 feeAmount
  );
  event Repay(
    address indexed sponsor,
    uint256 indexed numTokensRepaid,
    uint256 indexed newTokenCount,
    uint256 feeAmount
  );
  event EmergencyShutdown(address indexed caller, uint256 shutdownTimestamp);
  event SettleEmergencyShutdown(
    address indexed caller,
    uint256 indexed collateralReturned,
    uint256 indexed tokensBurned
  );

  //----------------------------------------
  // External functions
  //----------------------------------------

  function depositTo(
    PerpetualPositionManagerMultiParty.PositionData storage positionData,
    PerpetualPositionManagerMultiParty.GlobalPositionData
      storage globalPositionData,
    PerpetualPositionManagerMultiParty.PositionManagerData
      storage positionManagerData,
    FixedPoint.Unsigned memory collateralAmount,
    FeePayerParty.FeePayerData storage feePayerData,
    address sponsor
  ) external {
    require(collateralAmount.isGreaterThan(0), 'Invalid collateral amount');

    // Increase the position and global collateral balance by collateral amount.
    positionData._incrementCollateralBalances(
      globalPositionData,
      collateralAmount,
      feePayerData
    );

    emit Deposit(sponsor, collateralAmount.rawValue);

    feePayerData.collateralCurrency.safeTransferFrom(
      msg.sender,
      address(this),
      collateralAmount.rawValue
    );
  }

  function withdraw(
    PerpetualPositionManagerMultiParty.PositionData storage positionData,
    PerpetualPositionManagerMultiParty.GlobalPositionData
      storage globalPositionData,
    PerpetualPositionManagerMultiParty.PositionManagerData
      storage positionManagerData,
    FixedPoint.Unsigned memory collateralAmount,
    FeePayerParty.FeePayerData storage feePayerData
  ) external returns (FixedPoint.Unsigned memory amountWithdrawn) {
    require(collateralAmount.isGreaterThan(0), 'Invalid collateral amount');

    // Decrement the sponsor's collateral and global collateral amounts.
    // Reverts if the resulting position is not properly collateralized
    amountWithdrawn = _decrementCollateralBalancesCheckCR(
      positionData,
      globalPositionData,
      collateralAmount,
      positionManagerData.overCollateralization,
      positionManagerData.synthereumFinder,
      positionManagerData.priceIdentifier,
      feePayerData
    );

    emit Withdrawal(msg.sender, amountWithdrawn.rawValue);

    // Move collateral currency from contract to sender.
    // Note: that we move the amount of collateral that is decreased from rawCollateral (inclusive of fees)
    // instead of the user requested amount. This eliminates precision loss that could occur
    // where the user withdraws more collateral than rawCollateral is decremented by.
    feePayerData.collateralCurrency.safeTransfer(
      msg.sender,
      amountWithdrawn.rawValue
    );
  }

  function create(
    PerpetualPositionManagerMultiParty.PositionData storage positionData,
    PerpetualPositionManagerMultiParty.GlobalPositionData
      storage globalPositionData,
    PerpetualPositionManagerMultiParty.PositionManagerData
      storage positionManagerData,
    FixedPoint.Unsigned memory collateralAmount,
    FixedPoint.Unsigned memory numTokens,
    FixedPoint.Unsigned memory feePercentage,
    FeePayerParty.FeePayerData storage feePayerData
  ) external returns (FixedPoint.Unsigned memory feeAmount) {
    // TODO
    feeAmount = _checkAndCalculateDaoFee(
      globalPositionData,
      positionManagerData,
      numTokens,
      feePercentage,
      feePayerData
    );
    FixedPoint.Unsigned memory netCollateralAmount =
      collateralAmount.sub(feeAmount);

    if (positionData.tokensOutstanding.isEqual(0)) {
      // new position check is collateralized
      require(
        _checkCollateralization(
          netCollateralAmount,
          numTokens,
          positionManagerData.overCollateralization,
          positionManagerData.synthereumFinder,
          positionManagerData.priceIdentifier
        ),
        'Insufficient Collateral'
      );
      require(
        numTokens.isGreaterThanOrEqual(positionManagerData.minSponsorTokens),
        'Below minimum sponsor position'
      );
      emit NewSponsor(msg.sender);
    } else {
      // not a new position, check CR on updated position
      require(
        _checkCollateralization(
          positionData
            .rawCollateral
            .getFeeAdjustedCollateral(feePayerData.cumulativeFeeMultiplier)
            .add(netCollateralAmount),
          positionData.tokensOutstanding.add(numTokens),
          positionManagerData.overCollateralization,
          positionManagerData.synthereumFinder,
          positionManagerData.priceIdentifier
        ),
        'Insufficient Collateral'
      );
    }

    // Increase the position and global collateral balance by collateral amount.
    _incrementCollateralBalances(
      positionData,
      globalPositionData,
      netCollateralAmount,
      feePayerData
    );

    // Add the number of tokens created to the position's outstanding tokens.
    positionData.tokensOutstanding = positionData.tokensOutstanding.add(
      numTokens
    );

    globalPositionData.totalTokensOutstanding = globalPositionData
      .totalTokensOutstanding
      .add(numTokens);

    checkMintLimit(globalPositionData, positionManagerData);

    emit PositionCreated(
      msg.sender,
      collateralAmount.rawValue,
      numTokens.rawValue,
      feeAmount.rawValue
    );

    IERC20 collateralCurrency = feePayerData.collateralCurrency;

    collateralCurrency.safeTransferFrom(
      msg.sender,
      address(this),
      (collateralAmount).rawValue
    );

    // Transfer tokens into the contract from caller and mint corresponding synthetic tokens to the caller's address.
    collateralCurrency.safeTransfer(
      positionManagerData._getDaoFeeRecipient(),
      feeAmount.rawValue
    );

    positionManagerData.tokenCurrency.mint(msg.sender, numTokens.rawValue);
  }

  function redeeem(
    PerpetualPositionManagerMultiParty.PositionData storage positionData,
    PerpetualPositionManagerMultiParty.GlobalPositionData
      storage globalPositionData,
    PerpetualPositionManagerMultiParty.PositionManagerData
      storage positionManagerData,
    FixedPoint.Unsigned memory numTokens,
    FixedPoint.Unsigned memory feePercentage,
    FeePayerParty.FeePayerData storage feePayerData,
    address sponsor
  )
    external
    returns (
      FixedPoint.Unsigned memory amountWithdrawn,
      FixedPoint.Unsigned memory feeAmount
    )
  {
    require(
      numTokens.isLessThanOrEqual(positionData.tokensOutstanding),
      'Invalid token amount'
    );

    FixedPoint.Unsigned memory fractionRedeemed =
      numTokens.div(positionData.tokensOutstanding);
    FixedPoint.Unsigned memory collateralRedeemed =
      fractionRedeemed.mul(
        positionData.rawCollateral.getFeeAdjustedCollateral(
          feePayerData.cumulativeFeeMultiplier
        )
      );
    feeAmount = _checkAndCalculateDaoFee(
      globalPositionData,
      positionManagerData,
      numTokens,
      feePercentage,
      feePayerData
    );
    FixedPoint.Unsigned memory totAmountWithdrawn;
    // If redemption returns all tokens the sponsor has then we can delete their position. Else, downsize.
    if (positionData.tokensOutstanding.isEqual(numTokens)) {
      totAmountWithdrawn = positionData._deleteSponsorPosition(
        globalPositionData,
        feePayerData,
        sponsor
      );
    } else {
      // Decrement the sponsor's collateral and global collateral amounts.
      totAmountWithdrawn = positionData._decrementCollateralBalances(
        globalPositionData,
        collateralRedeemed,
        feePayerData
      );

      // Decrease the sponsors position tokens size. Ensure it is above the min sponsor size.
      FixedPoint.Unsigned memory newTokenCount =
        positionData.tokensOutstanding.sub(numTokens);
      require(
        newTokenCount.isGreaterThanOrEqual(
          positionManagerData.minSponsorTokens
        ),
        'Below minimum sponsor position'
      );
      positionData.tokensOutstanding = newTokenCount;
      // Update the totalTokensOutstanding after redemption.
      globalPositionData.totalTokensOutstanding = globalPositionData
        .totalTokensOutstanding
        .sub(numTokens);
    }

    amountWithdrawn = totAmountWithdrawn.sub(feeAmount);

    emit Redeem(
      msg.sender,
      amountWithdrawn.rawValue,
      numTokens.rawValue,
      feeAmount.rawValue
    );

    IERC20 collateralCurrency = feePayerData.collateralCurrency;

    {
      collateralCurrency.safeTransfer(msg.sender, amountWithdrawn.rawValue);
      collateralCurrency.safeTransfer(
        positionManagerData._getDaoFeeRecipient(),
        feeAmount.rawValue
      );
      // Transfer collateral from contract to caller and burn callers synthetic tokens.
      positionManagerData.tokenCurrency.safeTransferFrom(
        msg.sender,
        address(this),
        numTokens.rawValue
      );
      positionManagerData.tokenCurrency.burn(numTokens.rawValue);
    }
  }

  function repay(
    PerpetualPositionManagerMultiParty.PositionData storage positionData,
    PerpetualPositionManagerMultiParty.GlobalPositionData
      storage globalPositionData,
    PerpetualPositionManagerMultiParty.PositionManagerData
      storage positionManagerData,
    FixedPoint.Unsigned memory numTokens,
    FixedPoint.Unsigned memory feePercentage,
    FeePayerParty.FeePayerData storage feePayerData
  ) external returns (FixedPoint.Unsigned memory feeAmount) {
    require(
      numTokens.isLessThanOrEqual(positionData.tokensOutstanding),
      'Invalid token amount'
    );

    // Decrease the sponsors position tokens size. Ensure it is above the min sponsor size.
    FixedPoint.Unsigned memory newTokenCount =
      positionData.tokensOutstanding.sub(numTokens);
    require(
      newTokenCount.isGreaterThanOrEqual(positionManagerData.minSponsorTokens),
      'Below minimum sponsor position'
    );

    FixedPoint.Unsigned memory feeToWithdraw =
      _checkAndCalculateDaoFee(
        globalPositionData,
        positionManagerData,
        numTokens,
        feePercentage,
        feePayerData
      );

    positionData.tokensOutstanding = newTokenCount;

    // Update the totalTokensOutstanding after redemption.
    globalPositionData.totalTokensOutstanding = globalPositionData
      .totalTokensOutstanding
      .sub(numTokens);

    feeAmount = positionData._decrementCollateralBalances(
      globalPositionData,
      feeToWithdraw,
      feePayerData
    );

    emit Repay(
      msg.sender,
      numTokens.rawValue,
      newTokenCount.rawValue,
      feeAmount.rawValue
    );

    feePayerData.collateralCurrency.safeTransfer(
      positionManagerData._getDaoFeeRecipient(),
      feeAmount.rawValue
    );

    // Transfer the tokens back from the sponsor and burn them.
    positionManagerData.tokenCurrency.safeTransferFrom(
      msg.sender,
      address(this),
      numTokens.rawValue
    );
    positionManagerData.tokenCurrency.burn(numTokens.rawValue);
  }

  function settleEmergencyShutdown(
    PerpetualPositionManagerMultiParty.PositionData storage positionData,
    PerpetualPositionManagerMultiParty.GlobalPositionData
      storage globalPositionData,
    PerpetualPositionManagerMultiParty.PositionManagerData
      storage positionManagerData,
    FeePayerParty.FeePayerData storage feePayerData
  ) external returns (FixedPoint.Unsigned memory amountWithdrawn) {
    if (
      positionManagerData.emergencyShutdownPrice.isEqual(
        FixedPoint.fromUnscaledUint(0)
      )
    ) {
      // FixedPoint.Unsigned memory oraclePrice =
      //   positionManagerData._getOracleEmergencyShutdownPrice(feePayerData);
      // positionManagerData.emergencyShutdownPrice = oraclePrice
      //   ._decimalsScalingFactor(feePayerData);
    }

    // Get caller's tokens balance and calculate amount of underlying entitled to them.
    FixedPoint.Unsigned memory tokensToRedeem =
      FixedPoint.Unsigned(
        positionManagerData.tokenCurrency.balanceOf(msg.sender)
      );

    FixedPoint.Unsigned memory totalRedeemableCollateral =
      tokensToRedeem.mul(positionManagerData.emergencyShutdownPrice);

    // If the caller is a sponsor with outstanding collateral they are also entitled to their excess collateral after their debt.
    if (
      positionData
        .rawCollateral
        .getFeeAdjustedCollateral(feePayerData.cumulativeFeeMultiplier)
        .isGreaterThan(0)
    ) {
      // Calculate the underlying entitled to a token sponsor. This is collateral - debt in underlying with
      // the funding rate applied to the outstanding token debt.
      FixedPoint.Unsigned memory tokenDebtValueInCollateral =
        positionData.tokensOutstanding.mul(
          positionManagerData.emergencyShutdownPrice
        );
      FixedPoint.Unsigned memory positionCollateral =
        positionData.rawCollateral.getFeeAdjustedCollateral(
          feePayerData.cumulativeFeeMultiplier
        );

      // If the debt is greater than the remaining collateral, they cannot redeem anything.
      FixedPoint.Unsigned memory positionRedeemableCollateral =
        tokenDebtValueInCollateral.isLessThan(positionCollateral)
          ? positionCollateral.sub(tokenDebtValueInCollateral)
          : FixedPoint.Unsigned(0);

      // Add the number of redeemable tokens for the sponsor to their total redeemable collateral.
      totalRedeemableCollateral = totalRedeemableCollateral.add(
        positionRedeemableCollateral
      );

      PerpetualPositionManagerMultiParty(address(this)).deleteSponsorPosition(
        msg.sender
      );
      emit EndedSponsorPosition(msg.sender);
    }

    // Take the min of the remaining collateral and the collateral "owed". If the contract is undercapitalized,
    // the caller will get as much collateral as the contract can pay out.
    FixedPoint.Unsigned memory payout =
      FixedPoint.min(
        globalPositionData.rawTotalPositionCollateral.getFeeAdjustedCollateral(
          feePayerData.cumulativeFeeMultiplier
        ),
        totalRedeemableCollateral
      );

    // Decrement total contract collateral and outstanding debt.
    amountWithdrawn = globalPositionData
      .rawTotalPositionCollateral
      .removeCollateral(payout, feePayerData.cumulativeFeeMultiplier);
    globalPositionData.totalTokensOutstanding = globalPositionData
      .totalTokensOutstanding
      .sub(tokensToRedeem);

    emit SettleEmergencyShutdown(
      msg.sender,
      amountWithdrawn.rawValue,
      tokensToRedeem.rawValue
    );

    // Transfer tokens & collateral and burn the redeemed tokens.
    feePayerData.collateralCurrency.safeTransfer(
      msg.sender,
      amountWithdrawn.rawValue
    );
    positionManagerData.tokenCurrency.safeTransferFrom(
      msg.sender,
      address(this),
      tokensToRedeem.rawValue
    );
    positionManagerData.tokenCurrency.burn(tokensToRedeem.rawValue);
  }

  function trimExcess(
    PerpetualPositionManagerMultiParty.PositionManagerData
      storage positionManagerData,
    IERC20 token,
    FixedPoint.Unsigned memory pfcAmount,
    FeePayerParty.FeePayerData storage feePayerData
  ) external returns (FixedPoint.Unsigned memory amount) {
    FixedPoint.Unsigned memory balance =
      FixedPoint.Unsigned(token.balanceOf(address(this)));
    if (address(token) == address(feePayerData.collateralCurrency)) {
      // If it is the collateral currency, send only the amount that the contract is not tracking.
      // Note: this could be due to rounding error or balance-changing tokens, like aTokens.
      amount = balance.sub(pfcAmount);
    } else {
      // If it's not the collateral currency, send the entire balance.
      amount = balance;
    }
    token.safeTransfer(
      positionManagerData.excessTokenBeneficiary,
      amount.rawValue
    );
  }

  // TODO what's the difference with repay?
  // Reduces a sponsor's position and global counters by the specified parameters. Handles deleting the entire
  // position if the entire position is being removed. Does not make any external transfers.
  function reduceSponsorPosition(
    PerpetualPositionManagerMultiParty.PositionData storage positionData,
    PerpetualPositionManagerMultiParty.GlobalPositionData
      storage globalPositionData,
    PerpetualPositionManagerMultiParty.PositionManagerData
      storage positionManagerData,
    FixedPoint.Unsigned memory tokensToRemove,
    FixedPoint.Unsigned memory collateralToRemove,
    FixedPoint.Unsigned memory withdrawalAmountToRemove,
    FeePayerParty.FeePayerData storage feePayerData,
    address sponsor
  ) external {
    // If the entire position is being removed, delete it instead.
    if (
      tokensToRemove.isEqual(positionData.tokensOutstanding) &&
      positionData
        .rawCollateral
        .getFeeAdjustedCollateral(feePayerData.cumulativeFeeMultiplier)
        .isEqual(collateralToRemove)
    ) {
      positionData._deleteSponsorPosition(
        globalPositionData,
        feePayerData,
        sponsor
      );
      return;
    }

    // Decrement the sponsor's collateral and global collateral amounts.
    positionData._decrementCollateralBalances(
      globalPositionData,
      collateralToRemove,
      feePayerData
    );

    // Ensure that the sponsor will meet the min position size after the reduction.
    positionData.tokensOutstanding = positionData.tokensOutstanding.sub(
      tokensToRemove
    );
    require(
      positionData.tokensOutstanding.isGreaterThanOrEqual(
        positionManagerData.minSponsorTokens
      ),
      'Below minimum sponsor position'
    );

    // Decrement the total outstanding tokens in the overall contract.
    globalPositionData.totalTokensOutstanding = globalPositionData
      .totalTokensOutstanding
      .sub(tokensToRemove);
  }

  // Call to the internal one (see _getOraclePrice)
  function getOraclePrice(
    PerpetualPositionManagerMultiParty.PositionManagerData
      storage positionManagerData,
    uint256 requestedTime,
    FeePayerParty.FeePayerData storage feePayerData
  ) external view returns (FixedPoint.Unsigned memory price) {
    // return _getOraclePrice(positionManagerData, requestedTime, feePayerData);
  }

  //Call to the internal one (see _decimalsScalingFactor)
  function decimalsScalingFactor(
    FixedPoint.Unsigned memory oraclePrice,
    FeePayerParty.FeePayerData storage feePayerData
  ) external view returns (FixedPoint.Unsigned memory scaledPrice) {
    return _decimalsScalingFactor(oraclePrice, feePayerData);
  }

  //Call to the internal one (see _calculateDaoFee)
  function calculateDaoFee(
    PerpetualPositionManagerMultiParty.PositionManagerData
      storage positionManagerData,
    PerpetualPositionManagerMultiParty.GlobalPositionData
      storage globalPositionData,
    FixedPoint.Unsigned memory numTokens,
    FeePayerParty.FeePayerData storage feePayerData
  ) external view returns (FixedPoint.Unsigned memory) {
    return
      _calculateDaoFee(
        globalPositionData,
        numTokens,
        positionManagerData._getDaoFeePercentage(),
        feePayerData
      );
  }

  //Call to the internal ones (see _getDaoFeePercentage and _getDaoFeeRecipient)
  function daoFee(
    PerpetualPositionManagerMultiParty.PositionManagerData
      storage positionManagerData
  )
    external
    view
    returns (FixedPoint.Unsigned memory percentage, address recipient)
  {
    percentage = positionManagerData._getDaoFeePercentage();
    recipient = positionManagerData._getDaoFeeRecipient();
  }

  //Call to the internal one (see _getCapMintAmount)
  function capMintAmount(
    PerpetualPositionManagerMultiParty.PositionManagerData
      storage positionManagerData
  ) external view returns (FixedPoint.Unsigned memory capMint) {
    capMint = positionManagerData._getCapMintAmount();
  }

  //----------------------------------------
  // Internal functions
  //----------------------------------------
  function _incrementCollateralBalances(
    PerpetualPositionManagerMultiParty.PositionData storage positionData,
    PerpetualPositionManagerMultiParty.GlobalPositionData
      storage globalPositionData,
    FixedPoint.Unsigned memory collateralAmount,
    FeePayerParty.FeePayerData memory feePayerData
  ) internal returns (FixedPoint.Unsigned memory) {
    positionData.rawCollateral.addCollateral(
      collateralAmount,
      feePayerData.cumulativeFeeMultiplier
    );

    return
      globalPositionData.rawTotalPositionCollateral.addCollateral(
        collateralAmount,
        feePayerData.cumulativeFeeMultiplier
      );
  }

  // Ensure individual and global consistency when decrementing collateral balances. Returns the change to the
  // position. We elect to return the amount that the global collateral is decreased by, rather than the individual
  // position's collateral, because we need to maintain the invariant that the global collateral is always
  // <= the collateral owned by the contract to avoid reverts on withdrawals. The amount returned = amount withdrawn.
  function _decrementCollateralBalances(
    PerpetualPositionManagerMultiParty.PositionData storage positionData,
    PerpetualPositionManagerMultiParty.GlobalPositionData
      storage globalPositionData,
    FixedPoint.Unsigned memory collateralAmount,
    FeePayerParty.FeePayerData storage feePayerData
  ) internal returns (FixedPoint.Unsigned memory) {
    positionData.rawCollateral.removeCollateral(
      collateralAmount,
      feePayerData.cumulativeFeeMultiplier
    );
    return
      globalPositionData.rawTotalPositionCollateral.removeCollateral(
        collateralAmount,
        feePayerData.cumulativeFeeMultiplier
      );
  }

  function _decrementCollateralBalancesCheckCR(
    PerpetualPositionManagerMultiParty.PositionData storage positionData,
    PerpetualPositionManagerMultiParty.GlobalPositionData
      storage globalPositionData,
    FixedPoint.Unsigned memory collateralAmount,
    FixedPoint.Unsigned memory overCollateralization,
    ISynthereumFinder synthereumFinder,
    bytes32 priceFeedId,
    FeePayerParty.FeePayerData storage feePayerData
  ) internal returns (FixedPoint.Unsigned memory) {
    //remove the withdrawn collateral from the position and then check its CR
    positionData.rawCollateral.removeCollateral(
      collateralAmount,
      feePayerData.cumulativeFeeMultiplier
    );
    require(
      _checkPositionCollateralization(
        positionData,
        globalPositionData,
        overCollateralization,
        priceFeedId,
        synthereumFinder,
        feePayerData
      ),
      'CR is not sufficiently high after the withdraw'
    );
    return
      globalPositionData.rawTotalPositionCollateral.removeCollateral(
        collateralAmount,
        feePayerData.cumulativeFeeMultiplier
      );
  }

  // Deletes a sponsor's position and updates global counters. Does not make any external transfers.
  function _deleteSponsorPosition(
    PerpetualPositionManagerMultiParty.PositionData storage positionToLiquidate,
    PerpetualPositionManagerMultiParty.GlobalPositionData
      storage globalPositionData,
    FeePayerParty.FeePayerData storage feePayerData,
    address sponsor
  ) internal returns (FixedPoint.Unsigned memory) {
    FixedPoint.Unsigned memory startingGlobalCollateral =
      globalPositionData.rawTotalPositionCollateral.getFeeAdjustedCollateral(
        feePayerData.cumulativeFeeMultiplier
      );

    // Remove the collateral and outstanding from the overall total position.
    globalPositionData.rawTotalPositionCollateral = globalPositionData
      .rawTotalPositionCollateral
      .sub(positionToLiquidate.rawCollateral);
    globalPositionData.totalTokensOutstanding = globalPositionData
      .totalTokensOutstanding
      .sub(positionToLiquidate.tokensOutstanding);

    PerpetualPositionManagerMultiParty(address(this)).deleteSponsorPosition(
      sponsor
    );

    emit EndedSponsorPosition(sponsor);

    // Return fee-adjusted amount of collateral deleted from position.
    return
      startingGlobalCollateral.sub(
        globalPositionData.rawTotalPositionCollateral.getFeeAdjustedCollateral(
          feePayerData.cumulativeFeeMultiplier
        )
      );
  }

  // Checks whether the provided `collateral` and `numTokens` have a collateralization ratio above the global
  // collateralization ratio.
  function _checkPositionCollateralization(
    PerpetualPositionManagerMultiParty.PositionData storage positionData,
    PerpetualPositionManagerMultiParty.GlobalPositionData
      storage globalPositionData,
    FixedPoint.Unsigned memory overCollateralization,
    bytes32 priceFeedId,
    ISynthereumFinder synthereumFinder,
    FeePayerParty.FeePayerData storage feePayerData
  ) internal view returns (bool) {
    return
      _checkCollateralization(
        positionData.rawCollateral.getFeeAdjustedCollateral(
          feePayerData.cumulativeFeeMultiplier
        ),
        positionData.tokensOutstanding,
        overCollateralization,
        synthereumFinder,
        priceFeedId
      );
  }

  function _checkCollateralization(
    FixedPoint.Unsigned memory collateral,
    FixedPoint.Unsigned memory numTokens,
    FixedPoint.Unsigned memory overCollateralization,
    ISynthereumFinder finder,
    bytes32 priceFeedIdentifier
  ) internal view returns (bool) {
    // calculate the needed collateral with chainlink
    FixedPoint.Unsigned memory thresholdValue =
      numTokens.mul(getPriceFeedRate(finder, priceFeedIdentifier));
    thresholdValue = thresholdValue.mul(overCollateralization);
    return collateral.isGreaterThan(thresholdValue);
  }

  // Check new total number of tokens does not overcome mint limit
  function checkMintLimit(
    PerpetualPositionManagerMultiParty.GlobalPositionData
      storage globalPositionData,
    PerpetualPositionManagerMultiParty.PositionManagerData
      storage positionManagerData
  ) internal view {
    require(
      globalPositionData.totalTokensOutstanding.isLessThanOrEqual(
        positionManagerData._getCapMintAmount()
      ),
      'Total amount minted overcomes mint limit'
    );
  }

  // Check the fee percentage doesn not overcome max fee of user and calculate DAO fee using GCR
  function _checkAndCalculateDaoFee(
    PerpetualPositionManagerMultiParty.GlobalPositionData
      storage globalPositionData,
    PerpetualPositionManagerMultiParty.PositionManagerData
      storage positionManagerData,
    FixedPoint.Unsigned memory numTokens,
    FixedPoint.Unsigned memory feePercentage,
    FeePayerParty.FeePayerData storage feePayerData
  ) internal view returns (FixedPoint.Unsigned memory) {
    FixedPoint.Unsigned memory actualFeePercentage =
      positionManagerData._getDaoFeePercentage();
    require(
      actualFeePercentage.isLessThanOrEqual(feePercentage),
      'User fees are not enough for paying DAO'
    );
    return
      _calculateDaoFee(
        globalPositionData,
        numTokens,
        actualFeePercentage,
        feePayerData
      );
  }

  // Calculate Dao fee using GCR
  function _calculateDaoFee(
    PerpetualPositionManagerMultiParty.GlobalPositionData
      storage globalPositionData,
    FixedPoint.Unsigned memory numTokens,
    FixedPoint.Unsigned memory actualFeePercentage,
    FeePayerParty.FeePayerData storage feePayerData
  ) internal view returns (FixedPoint.Unsigned memory) {
    FixedPoint.Unsigned memory globalCollateralizationRatio =
      _getCollateralizationRatio(
        globalPositionData.rawTotalPositionCollateral.getFeeAdjustedCollateral(
          feePayerData.cumulativeFeeMultiplier
        ),
        globalPositionData.totalTokensOutstanding
      );
    return numTokens.mul(globalCollateralizationRatio).mul(actualFeePercentage);
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
    numTokens = collateralAmount.mul(10**(18 - collateralToken.decimals())).div(
      priceRate
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

  // TODO i guess this can be
  // Fetches a resolved Oracle price from the Oracle. Reverts if the Oracle hasn't resolved for this request.
  // function _getOracleEmergencyShutdownPrice(
  //   PerpetualPositionManagerMultiParty.PositionManagerData
  //     storage positionManagerData,
  //   FeePayerParty.FeePayerData storage feePayerData
  // ) internal view returns (FixedPoint.Unsigned memory) {
  //   return positionManagerData.getPriceFeedRate(
  //     positionManagerData.emergencyShutdownTimestamp,
  //     feePayerData
  //   );
  // }

  // Reduce orcale price according to the decimals of the collateral
  function _decimalsScalingFactor(
    FixedPoint.Unsigned memory oraclePrice,
    FeePayerParty.FeePayerData storage feePayerData
  ) internal view returns (FixedPoint.Unsigned memory scaledPrice) {
    uint8 collateralDecimalsNumber =
      IERC20Standard(address(feePayerData.collateralCurrency)).decimals();
    scaledPrice = oraclePrice.div(
      (10**(uint256(18)).sub(collateralDecimalsNumber))
    );
  }

  // Get mint amount limit
  function _getCapMintAmount(
    PerpetualPositionManagerMultiParty.PositionManagerData
      storage positionManagerData
  ) internal view returns (FixedPoint.Unsigned memory capMint) {
    capMint = FixedPoint.Unsigned(
      positionManagerData.getSelfMintingController().getCapMintAmount(
        address(this)
      )
    );
  }

  // Get Dao fee percentage
  function _getDaoFeePercentage(
    PerpetualPositionManagerMultiParty.PositionManagerData
      storage positionManagerData
  ) internal view returns (FixedPoint.Unsigned memory feePercentage) {
    feePercentage = FixedPoint.Unsigned(
      positionManagerData.getSelfMintingController().getDaoFeePercentage(
        address(this)
      )
    );
  }

  // Get Dao fee recipients
  function _getDaoFeeRecipient(
    PerpetualPositionManagerMultiParty.PositionManagerData
      storage positionManagerData
  ) internal view returns (address recipient) {
    recipient = positionManagerData
      .getSelfMintingController()
      .getDaoFeeRecipient(address(this));
  }

  // Get self-minting controller instance
  function getSelfMintingController(
    PerpetualPositionManagerMultiParty.PositionManagerData
      storage positionManagerData
  ) internal view returns (ISelfMintingController selfMintingController) {
    selfMintingController = ISelfMintingController(
      positionManagerData.synthereumFinder.getImplementationAddress(
        SynthereumInterfaces.SelfMintingController
      )
    );
  }

  // Calculate colltaeralization ratio
  function _getCollateralizationRatio(
    FixedPoint.Unsigned memory collateral,
    FixedPoint.Unsigned memory numTokens
  ) internal pure returns (FixedPoint.Unsigned memory ratio) {
    return
      numTokens.isLessThanOrEqual(0)
        ? FixedPoint.fromUnscaledUint(0)
        : collateral.div(numTokens);
  }
}
