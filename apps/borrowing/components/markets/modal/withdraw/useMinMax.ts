import { Market } from '@jarvis-network/synthereum-ts/dist/epics/markets';

import { FPN } from '@jarvis-network/core-utils/dist/base/fixed-point-number';
import { useMemo, useRef } from 'react';

import { calculateMaxDeposit } from '../helpers/MinMax';

import { errors } from './messages';

interface Result {
  maxCollateral: FPN;
  validInput: boolean;
  collateralError?: string | null;
}
const zero = (): Result => ({
  maxCollateral: new FPN(0),
  validInput: false,
});

export const useMinMax = (
  collateralValue: string,
  assetDetails: Market | null,
): Result => {
  const maxCollateralRef = useRef<FPN>(new FPN(0));
  return useMemo(() => {
    if (!assetDetails) {
      return zero();
    }
    let validInput = false;
    let collateralError: string | null = null;

    /* -------------------------------------------------------------------------- */
    /*                                 Calculation                                */
    /* -------------------------------------------------------------------------- */

    const max = calculateMaxDeposit(
      assetDetails!.positionCollateral!,
      assetDetails!.positionTokens!,
      assetDetails!.capDepositRatio!,
      assetDetails!.collateralTokenDecimals!,
    );
    maxCollateralRef.current = max;

    if (collateralValue !== '') {
      const inputSynthetic = FPN.toWei(collateralValue.toString());
      if (inputSynthetic.gt(maxCollateralRef.current)) {
        collateralError = errors.cce;
        validInput = false;
      }
    }

    /* -------------------------------------------------------------------------- */
    /*                                 Validation                                 */
    /* -------------------------------------------------------------------------- */

    if (collateralValue !== '') {
      const inputSynthetic = FPN.toWei(collateralValue.toString());

      if (
        inputSynthetic.gt(new FPN(0)) &&
        inputSynthetic.lte(maxCollateralRef.current)
      ) {
        validInput = true;
      } else {
        validInput = false;
      }
    }
    return {
      maxCollateral: maxCollateralRef.current,
      validInput,
      collateralError,
    };
  }, [collateralValue]);
};
