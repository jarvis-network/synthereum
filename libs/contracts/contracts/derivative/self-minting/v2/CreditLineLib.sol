// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.4;

import {ICreditLineStorage} from './interfaces/ICreditLineStorage.sol';
import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {IStandardERC20} from '../../../base/interfaces/IStandardERC20.sol';
import {
  BaseControlledMintableBurnableERC20
} from '../../../tokens/interfaces/BaseControlledMintableBurnableERC20.sol';
import {
  ISelfMintingController
} from '../common/interfaces/ISelfMintingController.sol';
import {ICreditLineController} from './interfaces/ICreditLineController.sol';
import {SynthereumInterfaces} from '../../../core/Constants.sol';
import {ISynthereumFinder} from '../../../core/interfaces/IFinder.sol';
import {
  FixedPoint
} from '@uma/core/contracts/common/implementation/FixedPoint.sol';
import {SafeMath} from '@openzeppelin/contracts/utils/math/SafeMath.sol';
import {
  SafeERC20
} from '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import {FeePayerPartyLib} from '../../common/FeePayerPartyLib.sol';
import {FeePayerParty} from '../../common/FeePayerParty.sol';
import {SynthereumCreditLine} from './CreditLine.sol';
import {
  ISynthereumPriceFeed
} from '../../../oracle/common/interfaces/IPriceFeed.sol';

library SynthereumCreditLineLib {
  using SafeMath for uint256;
  using FixedPoint for FixedPoint.Unsigned;
  using SafeERC20 for IERC20;
  using SafeERC20 for IStandardERC20;
  using SafeERC20 for BaseControlledMintableBurnableERC20;
  using SynthereumCreditLineLib for ICreditLineStorage.PositionData;
  using SynthereumCreditLineLib for ICreditLineStorage.PositionManagerData;
  using SynthereumCreditLineLib for ICreditLineStorage.FeeStatus;
  using SynthereumCreditLineLib for FeePayerParty.FeePayerData;
  using SynthereumCreditLineLib for FixedPoint.Unsigned;
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

  event ClaimFee(
    address indexed claimer,
    uint256 feeAmount,
    uint256 totalRemainingFees
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

  event SetFeePercentage(uint256 feePercentage);
  event SetFeeRecipients(address[] feeRecipients, uint32[] feeProportions);

  //----------------------------------------
  // External functions
  //----------------------------------------

  function depositTo(
    ICreditLineStorage.PositionData storage positionData,
    ICreditLineStorage.GlobalPositionData storage globalPositionData,
    ICreditLineStorage.PositionManagerData storage positionManagerData,
    FixedPoint.Unsigned memory collateralAmount,
    address sponsor
  ) external {
    require(collateralAmount.isGreaterThan(0), 'Invalid collateral amount');

    // Increase the position and global collateral balance by collateral amount.
    positionData._incrementCollateralBalances(
      globalPositionData,
      collateralAmount
    );

    emit Deposit(sponsor, collateralAmount.rawValue);

    positionManagerData.collateralToken.safeTransferFrom(
      msg.sender,
      address(this),
      collateralAmount.rawValue
    );
  }

  function withdraw(
    ICreditLineStorage.PositionData storage positionData,
    ICreditLineStorage.GlobalPositionData storage globalPositionData,
    ICreditLineStorage.PositionManagerData storage positionManagerData,
    FixedPoint.Unsigned memory collateralAmount
  ) external returns (FixedPoint.Unsigned memory) {
    require(collateralAmount.isGreaterThan(0), 'Invalid collateral amount');

    // Decrement the sponsor's collateral and global collateral amounts.
    // Reverts if the resulting position is not properly collateralized
    _decrementCollateralBalancesCheckCR(
      positionData,
      globalPositionData,
      positionManagerData,
      collateralAmount
    );

    emit Withdrawal(msg.sender, collateralAmount.rawValue);

    // Move collateral currency from contract to sender.
    positionManagerData.collateralToken.safeTransfer(
      msg.sender,
      collateralAmount.rawValue
    );

    return collateralAmount;
  }

  function create(
    ICreditLineStorage.PositionData storage positionData,
    ICreditLineStorage.GlobalPositionData storage globalPositionData,
    ICreditLineStorage.PositionManagerData storage positionManagerData,
    FixedPoint.Unsigned memory collateralAmount,
    FixedPoint.Unsigned memory numTokens,
    ICreditLineStorage.FeeStatus storage feeStatus
  ) external returns (FixedPoint.Unsigned memory feeAmount) {
    // Update fees status - percentage is retrieved from Credit Line Controller
    feeAmount = collateralAmount.mul(
      positionManagerData._getFeeInfo().feePercentage
    );
    positionManagerData.updateFees(feeStatus, feeAmount);

    FixedPoint.Unsigned memory netCollateralAmount =
      collateralAmount.sub(feeAmount);

    if (positionData.tokensOutstanding.isEqual(0)) {
      // new position check is collateralized
      (bool isCollateralised, ) =
        _checkCollateralization(
          positionManagerData,
          netCollateralAmount,
          numTokens
        );
      require(isCollateralised, 'Insufficient Collateral');
      require(
        numTokens.isGreaterThanOrEqual(positionManagerData.minSponsorTokens),
        'Below minimum sponsor position'
      );
      emit NewSponsor(msg.sender);
    } else {
      // not a new position, check CR on updated position
      (bool isCollateralised, ) =
        _checkCollateralization(
          positionManagerData,
          positionData.rawCollateral.add(netCollateralAmount),
          positionData.tokensOutstanding.add(numTokens)
        );
      require(isCollateralised, 'Insufficient Collateral');
    }

    // Increase the position and global collateral balance by collateral amount.
    positionData._incrementCollateralBalances(
      globalPositionData,
      netCollateralAmount
    );

    // Add the number of tokens created to the position's outstanding tokens and global.
    positionData.tokensOutstanding = positionData.tokensOutstanding.add(
      numTokens
    );

    globalPositionData.totalTokensOutstanding = globalPositionData
      .totalTokensOutstanding
      .add(numTokens);

    // TODO
    checkMintLimit(globalPositionData, positionManagerData);

    // pull collateral
    IERC20 collateralCurrency = positionManagerData.collateralToken;

    // Transfer tokens into the contract from caller
    collateralCurrency.safeTransferFrom(
      msg.sender,
      address(this),
      (collateralAmount).rawValue
    );

    // mint corresponding synthetic tokens to the caller's address.
    positionManagerData.tokenCurrency.mint(msg.sender, numTokens.rawValue);

    emit PositionCreated(
      msg.sender,
      netCollateralAmount.rawValue,
      numTokens.rawValue,
      feeAmount.rawValue
    );
  }

  function redeeem(
    ICreditLineStorage.PositionData storage positionData,
    ICreditLineStorage.GlobalPositionData storage globalPositionData,
    ICreditLineStorage.PositionManagerData storage positionManagerData,
    FixedPoint.Unsigned memory numTokens,
    ICreditLineStorage.FeeStatus storage feeStatus,
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
      fractionRedeemed.mul(positionData.rawCollateral);

    // Update fee status
    feeAmount = collateralRedeemed.mul(
      positionManagerData._getFeeInfo().feePercentage
    );
    positionManagerData.updateFees(feeStatus, feeAmount);

    // If redemption returns all tokens the sponsor has then we can delete their position. Else, downsize.
    if (positionData.tokensOutstanding.isEqual(numTokens)) {
      amountWithdrawn = positionData._deleteSponsorPosition(
        globalPositionData,
        sponsor
      );
    } else {
      // adjust the fees from collateral withdrawn
      amountWithdrawn = collateralRedeemed.sub(feeAmount);

      // Decrement the sponsor's collateral and global collateral amounts.
      positionData._decrementCollateralBalances(
        globalPositionData,
        collateralRedeemed
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

    // transfer collateral to user
    IERC20 collateralCurrency = positionManagerData.collateralToken;

    {
      collateralCurrency.safeTransfer(msg.sender, amountWithdrawn.rawValue);

      // Pull and burn callers synthetic tokens.
      positionManagerData.tokenCurrency.safeTransferFrom(
        msg.sender,
        address(this),
        numTokens.rawValue
      );
      positionManagerData.tokenCurrency.burn(numTokens.rawValue);
    }

    emit Redeem(
      msg.sender,
      amountWithdrawn.rawValue,
      numTokens.rawValue,
      feeAmount.rawValue
    );
  }

  function repay(
    ICreditLineStorage.PositionData storage positionData,
    ICreditLineStorage.GlobalPositionData storage globalPositionData,
    ICreditLineStorage.PositionManagerData storage positionManagerData,
    FixedPoint.Unsigned memory numTokens,
    ICreditLineStorage.FeeStatus storage feeStatus
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

    FixedPoint.Unsigned memory fractionRedeemed = numTokens.div(newTokenCount);

    // calculate the 'free' collateral from the repay amount
    FixedPoint.Unsigned memory collateralUnlocked =
      fractionRedeemed.mul(positionData.rawCollateral);

    // Update fee status
    feeAmount = collateralUnlocked.mul(
      positionManagerData._getFeeInfo().feePercentage
    );
    positionManagerData.updateFees(feeStatus, feeAmount);

    // update position
    positionData.tokensOutstanding = newTokenCount;

    // Update the totalTokensOutstanding after redemption.
    globalPositionData.totalTokensOutstanding = globalPositionData
      .totalTokensOutstanding
      .sub(numTokens);

    // Transfer the tokens back from the sponsor and burn them.
    positionManagerData.tokenCurrency.safeTransferFrom(
      msg.sender,
      address(this),
      numTokens.rawValue
    );
    positionManagerData.tokenCurrency.burn(numTokens.rawValue);

    emit Repay(
      msg.sender,
      numTokens.rawValue,
      newTokenCount.rawValue,
      feeAmount.rawValue
    );
  }

  function liquidate(
    ICreditLineStorage.PositionData storage positionToLiquidate,
    ICreditLineStorage.PositionManagerData storage positionManagerData,
    ICreditLineStorage.GlobalPositionData storage globalPositionData,
    FixedPoint.Unsigned calldata numSynthTokens
  )
    external
    returns (
      uint256,
      uint256,
      uint256
    )
  {
    // make sure position is undercollateralised
    (bool isCollateralised, FixedPoint.Unsigned memory maxTokensLiquidatable) =
      positionManagerData._checkCollateralization(
        positionToLiquidate.rawCollateral,
        positionToLiquidate.tokensOutstanding
      );
    require(!isCollateralised, 'Position is properly collateralised');

    // reduce LP position and global position
    FixedPoint.Unsigned memory tokensToLiquidate =
      maxTokensLiquidatable.isGreaterThan(numSynthTokens)
        ? numSynthTokens
        : maxTokensLiquidatable;

    FixedPoint.Unsigned memory collateralLiquidated =
      positionToLiquidate._reducePosition(
        globalPositionData,
        tokensToLiquidate
      );

    FixedPoint.Unsigned memory liquidatorReward =
      collateralLiquidated.mul(positionManagerData._getLiquidationReward());

    // transfer tokens from liquidator to here and burn them
    _burnLiquidatedTokens(
      positionManagerData,
      msg.sender,
      tokensToLiquidate.rawValue
    );

    // pay sender with collateral unlocked + rewards
    positionManagerData.collateralToken.safeTransfer(
      msg.sender,
      collateralLiquidated.add(liquidatorReward).rawValue
    );

    // return values
    return (
      collateralLiquidated.rawValue,
      tokensToLiquidate.rawValue,
      liquidatorReward.rawValue
    );
  }

  function settleEmergencyShutdown(
    ICreditLineStorage.PositionData storage positionData,
    ICreditLineStorage.GlobalPositionData storage globalPositionData,
    ICreditLineStorage.PositionManagerData storage positionManagerData
  ) external returns (FixedPoint.Unsigned memory amountWithdrawn) {
    // Get caller's tokens balance
    FixedPoint.Unsigned memory tokensToRedeem =
      FixedPoint.Unsigned(
        positionManagerData.tokenCurrency.balanceOf(msg.sender)
      );

    // calculate amount of underlying collateral entitled to them, with oracle emergency price
    FixedPoint.Unsigned memory totalRedeemableCollateral =
      tokensToRedeem.mul(positionManagerData.emergencyShutdownPrice);

    // If the caller is a sponsor with outstanding collateral they are also entitled to their excess collateral after their debt.
    if (positionData.rawCollateral.isGreaterThan(0)) {
      // Calculate the underlying entitled to a token sponsor. This is collateral - debt
      FixedPoint.Unsigned memory tokenDebtValueInCollateral =
        positionData.tokensOutstanding.mul(
          positionManagerData.emergencyShutdownPrice
        );

      require(
        tokenDebtValueInCollateral.isLessThan(positionData.rawCollateral),
        'You dont have free collateral to withdraw'
      );

      // Add the number of redeemable tokens for the sponsor to their total redeemable collateral.
      totalRedeemableCollateral = totalRedeemableCollateral.add(
        positionData.rawCollateral.sub(tokenDebtValueInCollateral)
      );

      SynthereumCreditLine(address(this)).deleteSponsorPosition(msg.sender);
      emit EndedSponsorPosition(msg.sender);
    }

    // Take the min of the remaining collateral and the collateral "owed". If the contract is undercapitalized,
    // the caller will get as much collateral as the contract can pay out.
    FixedPoint.Unsigned memory payout =
      FixedPoint.min(
        globalPositionData.rawTotalPositionCollateral,
        totalRedeemableCollateral
      );

    // Decrement total contract collateral and outstanding debt.
    globalPositionData.rawTotalPositionCollateral = globalPositionData
      .rawTotalPositionCollateral
      .sub(payout);
    globalPositionData.totalTokensOutstanding = globalPositionData
      .totalTokensOutstanding
      .sub(tokensToRedeem);

    emit SettleEmergencyShutdown(
      msg.sender,
      amountWithdrawn.rawValue,
      tokensToRedeem.rawValue
    );

    // Transfer tokens & collateral and burn the redeemed tokens.
    positionManagerData.collateralToken.safeTransfer(
      msg.sender,
      payout.rawValue
    );
    positionManagerData.tokenCurrency.safeTransferFrom(
      msg.sender,
      address(this),
      tokensToRedeem.rawValue
    );
    positionManagerData.tokenCurrency.burn(tokensToRedeem.rawValue);
  }

  /**
   * @notice Withdraw fees gained by the sender
   * @param self Data type the library is attached to
   * @param feeStatus Actual status of fee gained (see FeeStatus struct)
   * @return feeClaimed Amount of fee claimed
   */
  function claimFee(
    ICreditLineStorage.PositionManagerData storage self,
    ICreditLineStorage.FeeStatus storage feeStatus
  ) external returns (uint256 feeClaimed) {
    // Fee to claim
    FixedPoint.Unsigned memory _feeClaimed = feeStatus.feeGained[msg.sender];

    // Check that fee is available
    require(_feeClaimed.isGreaterThanOrEqual(0), 'No fee to claim');

    // Update fee status
    delete feeStatus.feeGained[msg.sender];

    FixedPoint.Unsigned memory _totalRemainingFees =
      feeStatus.totalFeeAmount.sub(_feeClaimed);

    feeStatus.totalFeeAmount = _totalRemainingFees;

    // Transfer amount to the sender
    feeClaimed = _feeClaimed.rawValue;

    self.collateralToken.safeTransfer(msg.sender, _feeClaimed.rawValue);

    emit ClaimFee(msg.sender, feeClaimed, _totalRemainingFees.rawValue);
  }

  /**
   * @notice Update fee gained by the fee recipients
   * @param feeStatus Actual status of fee gained to be withdrawn
   * @param feeAmount Collateral fee charged
   */
  function updateFees(
    ICreditLineStorage.PositionManagerData storage positionManagerData,
    ICreditLineStorage.FeeStatus storage feeStatus,
    FixedPoint.Unsigned memory feeAmount
  ) internal {
    FixedPoint.Unsigned memory feeCharged;

    ICreditLineStorage.Fee memory feeStruct = positionManagerData._getFeeInfo();
    address[] memory feeRecipients = feeStruct.feeRecipients;
    uint32[] memory feeProportions = feeStruct.feeProportions;

    for (uint256 i = 0; i < feeRecipients.length - 1; i++) {
      FixedPoint.Unsigned memory feeReceived =
        feeAmount.mul(feeProportions[i]).div(feeStruct.totalFeeProportions);

      feeStatus.feeGained[feeRecipients[i]] = feeStatus.feeGained[
        feeRecipients[i]
      ]
        .add(feeReceived);
      feeCharged = feeCharged.add(feeReceived);
    }

    address lastRecipient = feeRecipients[feeRecipients.length - 1];

    feeStatus.feeGained[lastRecipient] = feeStatus.feeGained[lastRecipient]
      .add(feeAmount)
      .sub(feeCharged);

    feeStatus.totalFeeAmount = feeStatus.totalFeeAmount.add(feeAmount);
  }

  // TODO
  function trimExcess(
    ICreditLineStorage.PositionManagerData storage positionManagerData,
    IERC20 token,
    FixedPoint.Unsigned memory pfcAmount,
    FeePayerParty.FeePayerData storage feePayerData
  ) external returns (FixedPoint.Unsigned memory amount) {
    FixedPoint.Unsigned memory balance =
      FixedPoint.Unsigned(token.balanceOf(address(this)));
    if (address(token) == address(positionManagerData.collateralToken)) {
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

  //Calls to the CreditLine controller
  function capMintAmount(
    ICreditLineStorage.PositionManagerData storage positionManagerData
  ) external view returns (FixedPoint.Unsigned memory capMint) {
    capMint = positionManagerData._getCapMintAmount();
  }

  function liquidationRewardPercentage(
    ICreditLineStorage.PositionManagerData storage positionManagerData
  ) external view returns (FixedPoint.Unsigned memory liqRewardPercentage) {
    liqRewardPercentage = positionManagerData._getLiquidationReward();
  }

  function feeInfo(
    ICreditLineStorage.PositionManagerData storage positionManagerData
  ) external view returns (ICreditLineStorage.Fee memory fee) {
    fee = positionManagerData._getFeeInfo();
  }

  function overCollateralization(
    ICreditLineStorage.PositionManagerData storage positionManagerData
  ) external view returns (FixedPoint.Unsigned memory percentage) {
    percentage = positionManagerData._getOverCollateralization();
  }

  //----------------------------------------
  // Internal functions
  //----------------------------------------
  function _burnLiquidatedTokens(
    ICreditLineStorage.PositionManagerData storage positionManagerData,
    address liquidator,
    uint256 amount
  ) internal {
    positionManagerData.tokenCurrency.safeTransferFrom(
      liquidator,
      address(this),
      amount
    );
    positionManagerData.tokenCurrency.burn(amount);
  }

  function _incrementCollateralBalances(
    ICreditLineStorage.PositionData storage positionData,
    ICreditLineStorage.GlobalPositionData storage globalPositionData,
    FixedPoint.Unsigned memory collateralAmount
  ) internal {
    positionData.rawCollateral = positionData.rawCollateral.add(
      collateralAmount
    );
    globalPositionData.rawTotalPositionCollateral = globalPositionData
      .rawTotalPositionCollateral
      .add(collateralAmount);
  }

  function _decrementCollateralBalances(
    ICreditLineStorage.PositionData storage positionData,
    ICreditLineStorage.GlobalPositionData storage globalPositionData,
    FixedPoint.Unsigned memory collateralAmount
  ) internal {
    positionData.rawCollateral = positionData.rawCollateral.sub(
      collateralAmount
    );
    globalPositionData.rawTotalPositionCollateral = globalPositionData
      .rawTotalPositionCollateral
      .sub(collateralAmount);
  }

  //remove the withdrawn collateral from the position and then check its CR
  function _decrementCollateralBalancesCheckCR(
    ICreditLineStorage.PositionData storage positionData,
    ICreditLineStorage.GlobalPositionData storage globalPositionData,
    ICreditLineStorage.PositionManagerData storage positionManagerData,
    FixedPoint.Unsigned memory collateralAmount
  ) internal {
    positionData.rawCollateral = positionData.rawCollateral.sub(
      collateralAmount
    );
    globalPositionData.rawTotalPositionCollateral = globalPositionData
      .rawTotalPositionCollateral
      .sub(collateralAmount);

    (bool isCollateralised, ) =
      _checkCollateralization(
        positionManagerData,
        positionData.rawCollateral,
        positionData.tokensOutstanding
      );
    require(
      isCollateralised,
      'CR is not sufficiently high after the withdraw - try less amount'
    );
  }

  // Deletes a sponsor's position and updates global counters. Does not make any external transfers.
  function _deleteSponsorPosition(
    ICreditLineStorage.PositionData storage positionToLiquidate,
    ICreditLineStorage.GlobalPositionData storage globalPositionData,
    address sponsor
  ) internal returns (FixedPoint.Unsigned memory) {
    // Remove the collateral and outstanding from the overall total position.
    globalPositionData.rawTotalPositionCollateral = globalPositionData
      .rawTotalPositionCollateral
      .sub(positionToLiquidate.rawCollateral);
    globalPositionData.totalTokensOutstanding = globalPositionData
      .totalTokensOutstanding
      .sub(positionToLiquidate.tokensOutstanding);

    // delete position entry from storage
    SynthereumCreditLine(address(this)).deleteSponsorPosition(sponsor);

    emit EndedSponsorPosition(sponsor);

    // Return unlocked amount of collateral
    return positionToLiquidate.rawCollateral;
  }

  function _reducePosition(
    ICreditLineStorage.PositionData storage positionToLiquidate,
    ICreditLineStorage.GlobalPositionData storage globalPositionData,
    FixedPoint.Unsigned memory tokensToLiquidate
  ) internal returns (FixedPoint.Unsigned memory collateralUnlocked) {
    // calculate collateral to unlock
    FixedPoint.Unsigned memory fractionRedeemed =
      tokensToLiquidate.div(positionToLiquidate.tokensOutstanding);

    collateralUnlocked = fractionRedeemed.mul(
      positionToLiquidate.rawCollateral
    );

    // reduce position
    positionToLiquidate.tokensOutstanding = positionToLiquidate
      .tokensOutstanding
      .sub(tokensToLiquidate);
    positionToLiquidate.rawCollateral = positionToLiquidate.rawCollateral.sub(
      collateralUnlocked
    );

    // update global position data
    globalPositionData.totalTokensOutstanding = globalPositionData
      .totalTokensOutstanding
      .sub(tokensToLiquidate);
    globalPositionData.rawTotalPositionCollateral = globalPositionData
      .rawTotalPositionCollateral
      .sub(collateralUnlocked);
  }

  function _checkCollateralization(
    ICreditLineStorage.PositionManagerData storage positionManagerData,
    FixedPoint.Unsigned memory collateral,
    FixedPoint.Unsigned memory numTokens
  ) internal view returns (bool, FixedPoint.Unsigned memory) {
    // get oracle price
    FixedPoint.Unsigned memory oraclePrice =
      _getOraclePrice(positionManagerData);

    uint256 collateralDecimals =
      getCollateralDecimals(positionManagerData.collateralToken);

    // calculate the min collateral of numTokens with chainlink
    FixedPoint.Unsigned memory thresholdValue =
      numTokens.mul(oraclePrice).div(10**(18 - collateralDecimals));

    thresholdValue = thresholdValue.mul(
      positionManagerData._getOverCollateralization()
    );

    // calculate the potential liquidatable portion
    // if the minimum collateral is greaater than position collateral then the position is undercollateralized
    FixedPoint.Unsigned memory liquidatableTokens =
      thresholdValue.isGreaterThan(collateral)
        ? thresholdValue.sub(collateral).div(oraclePrice).mul(
          10**(18 - collateralDecimals)
        )
        : FixedPoint.fromUnscaledUint(0);

    return (collateral.isGreaterThan(thresholdValue), liquidatableTokens);
  }

  // Check new total number of tokens does not overcome mint limit
  function checkMintLimit(
    ICreditLineStorage.GlobalPositionData storage globalPositionData,
    ICreditLineStorage.PositionManagerData storage positionManagerData
  ) internal view {
    require(
      globalPositionData.totalTokensOutstanding.isLessThanOrEqual(
        positionManagerData._getCapMintAmount()
      ),
      'Total amount minted overcomes mint limit'
    );
  }

  /**
   * @notice Retrun the on-chain oracle price for a pair
   * @return priceRate Latest rate of the pair
   */
  function _getOraclePrice(
    ICreditLineStorage.PositionManagerData storage positionManagerData
  ) internal view returns (FixedPoint.Unsigned memory priceRate) {
    ISynthereumPriceFeed priceFeed =
      ISynthereumPriceFeed(
        positionManagerData.synthereumFinder.getImplementationAddress(
          SynthereumInterfaces.PriceFeed
        )
      );
    priceRate = FixedPoint.Unsigned(
      priceFeed.getLatestPrice(positionManagerData.priceIdentifier)
    );
  }

  /// @notice calls CreditLineController to retrieve liquidation reward percentage
  function _getLiquidationReward(
    ICreditLineStorage.PositionManagerData storage positionManagerData
  ) internal view returns (FixedPoint.Unsigned memory liqRewardPercentage) {
    liqRewardPercentage = FixedPoint.Unsigned(
      positionManagerData
        .getCreditLineController()
        .getLiquidationRewardPercentage(address(this))
    );
  }

  function _getFeeInfo(
    ICreditLineStorage.PositionManagerData storage positionManagerData
  ) internal view returns (ICreditLineStorage.Fee memory fee) {
    fee = positionManagerData.getCreditLineController().getFeeInfo(
      address(this)
    );
  }

  function _getOverCollateralization(
    ICreditLineStorage.PositionManagerData storage positionManagerData
  )
    internal
    view
    returns (FixedPoint.Unsigned memory overCollateralizationPercentage)
  {
    overCollateralizationPercentage = FixedPoint.Unsigned(
      positionManagerData
        .getCreditLineController()
        .getOvercollateralizationPercentage(address(this))
    );
  }

  // Get mint amount limit from CreditLineController
  function _getCapMintAmount(
    ICreditLineStorage.PositionManagerData storage positionManagerData
  ) internal view returns (FixedPoint.Unsigned memory capMint) {
    capMint = FixedPoint.Unsigned(
      positionManagerData.getCreditLineController().getCapMintAmount(
        address(this)
      )
    );
  }

  // Get self-minting controller instance
  function getCreditLineController(
    ICreditLineStorage.PositionManagerData storage positionManagerData
  ) internal view returns (ICreditLineController creditLineController) {
    creditLineController = ICreditLineController(
      positionManagerData.synthereumFinder.getImplementationAddress(
        SynthereumInterfaces.CreditLineController
      )
    );
  }

  function getCollateralDecimals(IStandardERC20 collateralToken)
    internal
    view
    returns (uint256 decimals)
  {
    decimals = collateralToken.decimals();
  }
}
