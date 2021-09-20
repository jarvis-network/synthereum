/* eslint-disable no-underscore-dangle */
import { StringAmount } from '@jarvis-network/core-utils/dist/base/big-number';
import { FPN } from '@jarvis-network/core-utils/dist/base/fixed-point-number';

export const calculateGlobalCollateralizationRatio = (
  gcr: StringAmount,
  price: StringAmount,
) => {
  const _collateralizationRatio = FPN.fromWei(gcr);
  if (!price) {
    return new FPN(1);
  }
  const _price = FPN.fromWei(price);

  if (_price.lte(new FPN('0'))) {
    return new FPN(0);
  }

  return _collateralizationRatio.mul(new FPN(1).div(_price)).mul(new FPN(100));
};
/**
 * collateralRequirement < (UserNewCR * Collateral price expressed in Synth * 100)
 */

export const calculateUserCollateralizationRatio = (
  positionCollateral: StringAmount,
  positionTokens: StringAmount,
  price: StringAmount,
  collateralPrice: StringAmount,
) => {
  if (!price) {
    return new FPN(1);
  }
  const _positionCollateral = FPN.fromWei(positionCollateral);
  if (_positionCollateral.lte(new FPN('0'))) {
    return new FPN(0);
  }
  const _positionTokens = FPN.fromWei(positionTokens);
  const _price = FPN.fromWei(price);
  const _collateralPrice = FPN.fromWei(collateralPrice);

  if (_price.lte(new FPN('0'))) {
    return new FPN(0);
  }

  return _positionCollateral
    .div(_positionTokens)
    .mul(_collateralPrice.div(_price))
    .mul(FPN.toWei('100'));
};

export const calculateLiquidationThreshold = (
  collateralRequirement: StringAmount,
  ucr: FPN,
  price: StringAmount,
  collateralPrice: StringAmount,
) => {
  const _collateralRequirement = FPN.fromWei(collateralRequirement);
  const _price = FPN.fromWei(price);
  const _collateralPrice = FPN.fromWei(collateralPrice);

  return _collateralRequirement.lt(
    ucr.mul(_collateralPrice.div(_price)).mul(new FPN(100)),
  );
};
