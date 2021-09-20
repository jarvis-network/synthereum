/* eslint-disable no-underscore-dangle */
import { scaleTokenAmountToWei } from '@jarvis-network/core-utils/dist/eth/contracts/erc20';
import { FPN } from '@jarvis-network/core-utils/dist/base/fixed-point-number';
import {
  StringAmount,
  wei,
} from '@jarvis-network/core-utils/dist/base/big-number';
import { calculateDaoFee } from '@jarvis-network/synthereum-ts/dist/core/realms/self-minting/utils';

/* -------------------------------------------------------------------------- */
/*                                   BORROW                                   */
/* -------------------------------------------------------------------------- */
export const calculateMinMaxBorrowFromSynthetic = (
  inputSynthetic: FPN,
  gcr: StringAmount,
  feePercentage: StringAmount,
  capDepositRatio: StringAmount,
  collateralTokenDecimals: number,
  positionTokens: StringAmount,
  positionCollateral: StringAmount,
) => {
  const fee = calculateDaoFee({
    collateral: inputSynthetic,
    collateralizationRatio: gcr,
    feePercentage,
  });
  const globalCollateralizationRatio = FPN.fromWei(gcr);
  const _capDepositRatio = FPN.fromWei(
    scaleTokenAmountToWei({
      amount: wei(capDepositRatio!),
      decimals: collateralTokenDecimals,
    }),
  );
  const _positionTokens = FPN.fromWei(positionTokens);
  const _positionCollateral = FPN.fromWei(positionCollateral);

  if (_positionTokens.gt(new FPN(0))) {
    /**
     * (depositLimit * (UserInputOfSynth + position.totalTokensOutstanding) ) - getCollateral(address) + calculateDaoFee(UserInputOfSynth))
     */
    const max = _capDepositRatio
      .mul(inputSynthetic.add(_positionTokens))
      .sub(_positionCollateral)
      .add(fee);
    /**
     * min_collateral = (positions.tokensOutstanding * GCR) + (UserInputOfTokens * GCR) + calculateDaoFee(UserInputOfTokens) - getCollateral(address)
     */
    const min = _positionTokens
      .mul(globalCollateralizationRatio)
      .add(inputSynthetic.mul(globalCollateralizationRatio))
      .add(fee)
      .sub(_positionCollateral);
    return [max, min];
  }
  const max = inputSynthetic.mul(_capDepositRatio).add(fee);
  const min = inputSynthetic.mul(globalCollateralizationRatio).add(fee);
  return [max, min];
};
/**
 * max_num_tokens = (UserInputCollateral - ( (UserInputCollateral * feePercentage) / (1 + feePercentage))) / GCR
 * (i − ((i × f) ÷ (1 + f))) ÷ g
 * min_num_tokens =
 * (UserInputCollateral -  (feePercentage * UserInputCollateral * GCR / ((feePercentage * GCR) + capDepositRatio))) / capDepositRatio
 * (i - (f *i * g) / ((f * g) + c)) / c
 *
 */
export const calculateMinMaxSyntheticBorrowFromCollateral = (
  inputCollateral: FPN,
  gcr: StringAmount,
  feePercentage: StringAmount,
  capDepositRatio: StringAmount,
  collateralTokenDecimals: number,
  positionTokens: StringAmount,
  positionCollateral: StringAmount,
) => {
  const _feePercentage = FPN.fromWei(feePercentage);
  const globalCollateralizationRatio = FPN.fromWei(gcr);
  const _capDepositRatio = FPN.fromWei(
    scaleTokenAmountToWei({
      amount: wei(capDepositRatio!),
      decimals: collateralTokenDecimals,
    }),
  );
  const _positionTokens = FPN.fromWei(positionTokens);
  const _positionCollateral = FPN.fromWei(positionCollateral);
  if (_positionTokens.gt(new FPN(0))) {
    /**
     * ((UserInputOfCollateral + getCollateral(address) - ((UserInputOfCollateral * feePercentage) / (1 + feePercentage))) / GCR) - positions.tokensOutstanding
     */
    const max = inputCollateral
      .add(_positionCollateral)
      .sub(
        inputCollateral.mul(_feePercentage).div(new FPN(1).add(_feePercentage)),
      )
      .div(globalCollateralizationRatio)
      .sub(_positionTokens);
    /** min_num_tokens = _positionCollateral  + UserInputOfCollateral - ((UserInputOfCollateral * feePercentage) / (1 + feePercentage))) / capDepositRatio) - position.tokensOutstandin */

    const min = _positionCollateral
      .add(inputCollateral)
      .sub(
        inputCollateral.mul(_feePercentage).div(new FPN(1).add(_feePercentage)),
      )
      .div(_capDepositRatio)
      .sub(_positionTokens);
    return [max.sub(new FPN(0.1)), min];
  }

  const max = inputCollateral
    .sub(
      inputCollateral.mul(_feePercentage).div(new FPN(1).add(_feePercentage)),
    )
    .div(globalCollateralizationRatio);

  /**
   *
   * (UserInputCollateral -  (feePercentage * UserInputCollateral * GCR / ((feePercentage * GCR) + capDepositRatio))) / capDepositRatio
   */
  const min = inputCollateral
    .sub(
      _feePercentage
        .mul(inputCollateral)
        .mul(
          globalCollateralizationRatio.div(
            _feePercentage
              .mul(globalCollateralizationRatio)
              .add(_capDepositRatio),
          ),
        ),
    )
    .div(_capDepositRatio);
  return [max, min];
};

// UserGCR = rawCollateral / tokensOutstanding
export const calculateUserCollateralizationRatio = (
  positionCollateral: StringAmount,
  positionTokens: StringAmount,
) => {
  const _positionCollateral = FPN.fromWei(positionCollateral);
  if (_positionCollateral.lte(new FPN('0'))) {
    return new FPN(0);
  }
  const _positionTokens = FPN.fromWei(positionTokens);

  return _positionCollateral.div(_positionTokens);
};

export const calculateBorrowNewCollateralizationRatio = (
  positionCollateral: StringAmount,
  positionTokens: StringAmount,
  inputCollateral: FPN,
  inputSynthetic: FPN,
  feePercentage: StringAmount,
  gcr: StringAmount,
  price: StringAmount,
  collateralPrice: StringAmount,
) => {
  const fee = calculateDaoFee({
    collateral: inputSynthetic,
    collateralizationRatio: gcr,
    feePercentage,
  });
  const _positionCollateral = FPN.fromWei(positionCollateral);

  const _positionTokens = FPN.fromWei(positionTokens);
  const _price = FPN.fromWei(price);
  const _collateralPrice = FPN.fromWei(collateralPrice);

  /**
   *  New user  (userInputOfCollateral - calculateDaoFee(userInputOfSyntheticTokens) / userInputOfSyntheticTokens) * UMAjSynthToken price * 100
   * (ic - fee / is) * cp/p * 100
   * Already borrowed (userInputOfCollateral - calculateDaoFee(userInputOfSyntheticTokens) + rawCollateral) / (userInputOfSyntheticTokens + tokensOutstanding) * UMAjSynthToken price * 100
   * ((ic - fee + pc) / (is + pt) ) * cp/p * 100
   *
   */

  if (_positionTokens.lte(new FPN(0))) {
    // Newly borrow
    return inputCollateral
      .sub(fee)
      .div(inputSynthetic)
      .mul(new FPN(1).div(_price))
      .mul(new FPN(100));
  }
  // Existing borrow
  return inputCollateral
    .sub(fee)
    .add(_positionCollateral)
    .div(_positionTokens.add(inputSynthetic))
    .mul(new FPN(1).div(_price))
    .mul(new FPN(100));
};

/**
 * First
 * LiquidationPrice = (Collateral requirement * (UserInputOfTokens / (UserInputOfCollateral - fee)) * jSynth/USD)
 *
 * Previous
 * LiquidationPrice = ((Collateral Requirement * ((tokensOutstanding + UserInputOfTokens) / (rawCollateral + (UserInputOfCollateral - fee)))) * jSynth/USD)
 */

export const calculateBorrowLiquidationPrice = (
  collateralRequirement: StringAmount,
  positionTokens: StringAmount,
  inputSynthetic: FPN,
  positionCollateral: StringAmount,
  inputCollateral: FPN,
  price: StringAmount,
  gcr: StringAmount,
  feePercentage: StringAmount,
) => {
  const _positionCollateral = FPN.fromWei(positionCollateral);

  const _positionTokens = FPN.fromWei(positionTokens);
  const _price = FPN.fromWei(price);
  const _collateralRequirement = FPN.fromWei(collateralRequirement);
  const fee = calculateDaoFee({
    collateral: inputSynthetic,
    collateralizationRatio: gcr,
    feePercentage,
  });

  if (_positionTokens.lte(new FPN(0))) {
    // Newly borrow
    return _collateralRequirement
      .mul(inputSynthetic)
      .div(inputCollateral.sub(fee))
      .mul(_price);
  }

  return _collateralRequirement
    .mul(
      _positionTokens
        .add(inputSynthetic)
        .div(_positionCollateral.add(inputCollateral.sub(fee))),
    )
    .mul(_price);
};
