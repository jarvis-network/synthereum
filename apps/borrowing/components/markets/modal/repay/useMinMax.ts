import { Market } from '@jarvis-network/synthereum-ts/dist/epics/markets';

import { FPN } from '@jarvis-network/core-utils/dist/base/fixed-point-number';
import { useMemo, useRef } from 'react';

import { calculateMaxSyntheticRepay } from '../helpers/MinMax';

import { errors } from './messages';

interface Result {
  maxSynthetic: FPN;
  validInput: boolean;
  syntheticError?: string | null;
}
const zero = (): Result => ({
  maxSynthetic: new FPN(0),
  validInput: false,
});

export const useMinMax = (
  syntheticValue: string,
  assetDetails: Market | null,
): Result => {
  const maxSyntheticRef = useRef<FPN>(new FPN(0));
  return useMemo(() => {
    if (!assetDetails) {
      return zero();
    }
    let validInput = false;
    let syntheticError: string | null = null;

    /* -------------------------------------------------------------------------- */
    /*                                 Calculation                                */
    /* -------------------------------------------------------------------------- */

    const max = calculateMaxSyntheticRepay(
      assetDetails.positionCollateral!,
      assetDetails.positionTokens!,
      assetDetails.feePercentage!,
      assetDetails.capDepositRatio!,
      assetDetails.collateralTokenDecimals!,
    );
    maxSyntheticRef.current = max;

    if (syntheticValue !== '') {
      const inputSynthetic = FPN.toWei(syntheticValue.toString());
      if (inputSynthetic.gt(maxSyntheticRef.current)) {
        syntheticError = errors.cce;
        validInput = false;
      }
    }

    /* -------------------------------------------------------------------------- */
    /*                                 Validation                                 */
    /* -------------------------------------------------------------------------- */

    if (syntheticValue !== '') {
      const inputSynthetic = FPN.toWei(syntheticValue.toString());

      if (
        inputSynthetic.gt(new FPN(0)) &&
        inputSynthetic.lte(maxSyntheticRef.current)
      ) {
        validInput = true;
        syntheticError = null;
      } else {
        validInput = false;
        syntheticError = errors.cce;
      }
    }
    if (maxSyntheticRef.current.lt(new FPN(0))) {
      return {
        maxSynthetic: new FPN(0),
        validInput: false,
        syntheticError: null,
      };
    }
    return {
      maxSynthetic: maxSyntheticRef.current,
      validInput,
      syntheticError,
    };
  }, [syntheticValue]);
};
