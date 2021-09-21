import { Market } from '@jarvis-network/synthereum-ts/dist/epics/markets';

import { FPN } from '@jarvis-network/core-utils/dist/base/fixed-point-number';
import { useMemo, useRef } from 'react';

import {
  calculateMaxCollateralToReceive,
  calculateMaxSynthToBurn,
  calculateUserCollateralizationRatio,
} from '../helpers/MinMax';

interface Result {
  maxSynthetic: FPN;
  maxCollateral: FPN;
  maxSyntheticAllowed: FPN;
}
const zero = (): Result => ({
  maxSynthetic: new FPN(0),
  maxCollateral: new FPN(0),
  maxSyntheticAllowed: new FPN(0),
});

export const useMinMax = (
  collateralValue: string,
  syntheticValue: string,
  assetDetails: Market | null,
): Result => {
  const maxSyntheticRef = useRef<FPN>(new FPN(0));
  const maxCollateralRef = useRef<FPN>(new FPN(0));
  return useMemo(() => {
    if (!assetDetails) {
      return zero();
    }

    const ucr = calculateUserCollateralizationRatio(
      assetDetails!.positionCollateral!,
      assetDetails!.positionTokens!,
    );

    /* -------------------------------------------------------------------------- */
    /*                                 Calculation                                */
    /* -------------------------------------------------------------------------- */

    if (collateralValue !== '') {
      const inputCollateral = FPN.toWei(collateralValue.toString());
      const synthToBurn = calculateMaxSynthToBurn(
        inputCollateral,
        ucr,
        assetDetails!.feePercentage!,
      );
      maxSyntheticRef.current = synthToBurn!;
    }

    if (syntheticValue !== '') {
      const inputSynthetic = FPN.toWei(syntheticValue.toString());

      const collateralToReceive = calculateMaxCollateralToReceive(
        inputSynthetic,
        ucr,
        assetDetails!.feePercentage!,
        assetDetails!.collateralizationRatio!,
      );
      maxCollateralRef.current = collateralToReceive!;
    }
    if (collateralValue === '' && syntheticValue === '') {
      maxSyntheticRef.current = new FPN('0');
      maxCollateralRef.current = new FPN('0');
    }

    return {
      maxSynthetic: maxSyntheticRef.current,
      maxCollateral: maxCollateralRef.current,
      maxSyntheticAllowed: FPN.fromWei(assetDetails.positionTokens!).sub(
        new FPN(50),
      ),
    };
  }, [syntheticValue, collateralValue]);
};
