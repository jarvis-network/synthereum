import {
  Amount,
  StringAmount,
  toBN,
} from '@jarvis-network/core-utils/dist/base/big-number';

import { divideBigInt } from './BigInt';

export const calculateGCR = (
  totalTokensOutstanding: Amount,
  totalPositionCollateral: Amount,
): StringAmount => {
  if (
    totalPositionCollateral.eq(toBN('0')) ||
    totalTokensOutstanding.eq(toBN('0'))
  ) {
    return '0' as StringAmount;
  }

  const collateral = BigInt(totalPositionCollateral.toString(10));
  const tokens = BigInt(totalTokensOutstanding.toString(10));

  const globalCollateralizationRation = divideBigInt(collateral, tokens);

  return globalCollateralizationRation;
};

export const getLiquidationRatio = (
  collateralRequirement: Amount,
): StringAmount => collateralRequirement.toString() as StringAmount;
