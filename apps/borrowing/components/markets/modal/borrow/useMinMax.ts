import { Market } from '@jarvis-network/synthereum-ts/dist/epics/markets';

import { FPN } from '@jarvis-network/core-utils/dist/base/fixed-point-number';
import { useMemo, useRef } from 'react';

import {
  calculateMinMaxBorrowFromSynthetic,
  calculateMinMaxSyntheticBorrowFromCollateral,
} from '../helpers/MinMax';

import { errors } from './messages';

interface Result {
  minSynthetic: FPN;
  maxSynthetic: FPN;
  minCollateral: FPN;
  maxCollateral: FPN;
  validInput: boolean;
  collateralError?: string | null;
  syntheticError?: string | null;
}
const zero = (): Result => ({
  minSynthetic: new FPN(0),
  maxSynthetic: new FPN(0),
  minCollateral: new FPN(0),
  maxCollateral: new FPN(0),
  validInput: false,
});

function numberLength(num: string) {
  const s = num.split('.');
  const beforeDecimal = s[0];
  return [beforeDecimal.length];
}

export const useMinMax = (
  collateralValue: string,
  syntheticValue: string,
  assetDetails: Market | null,
  inputFocus: 'collateral' | 'synthetic',
): Result => {
  const minSyntheticRef = useRef<FPN>(new FPN(0));
  const maxSyntheticRef = useRef<FPN>(new FPN(0));
  const minCollateralRef = useRef<FPN>(new FPN(0));
  const maxCollateralRef = useRef<FPN>(new FPN(0));
  return useMemo(() => {
    if (!assetDetails) {
      return zero();
    }
    if (collateralValue === '' && syntheticValue === '') {
      minSyntheticRef.current = new FPN(0);
      maxSyntheticRef.current = new FPN(0);
      minCollateralRef.current = new FPN(0);
      maxCollateralRef.current = new FPN(0);
      return zero();
    }
    let validInput = false;
    let collateralError: string | null = null;
    let syntheticError: string | null = null;

    /* -------------------------------------------------------------------------- */
    /*                                 Calculation                                */
    /* -------------------------------------------------------------------------- */
    // case 1
    // input collateral and synthetic empty
    if (collateralValue !== '' && syntheticValue === '') {
      const inputCollateral = FPN.toWei(collateralValue.toString());
      const [max, min] = calculateMinMaxSyntheticBorrowFromCollateral(
        inputCollateral,
        assetDetails!.collateralizationRatio!,
        assetDetails!.feePercentage!,
        assetDetails!.capDepositRatio!,
        assetDetails!.collateralTokenDecimals!,
        assetDetails!.positionTokens!,
        assetDetails!.positionCollateral!,
      );
      minSyntheticRef.current = min;
      maxSyntheticRef.current = max;
    } else if (syntheticValue !== '' && collateralValue === '') {
      const inputSynthetic = FPN.toWei(syntheticValue.toString());

      const [max, min] = calculateMinMaxBorrowFromSynthetic(
        inputSynthetic,
        assetDetails!.collateralizationRatio!,
        assetDetails!.feePercentage!,
        assetDetails!.capDepositRatio!,
        assetDetails!.collateralTokenDecimals!,
        assetDetails!.positionTokens!,
        assetDetails!.positionCollateral!,
      );
      minCollateralRef.current = min;
      maxCollateralRef.current = max;
    }

    if (
      syntheticValue !== '' &&
      collateralValue !== '' &&
      inputFocus === 'collateral'
    ) {
      const inputCollateral = FPN.toWei(maxCollateralRef.current.format(6));
      const [max, min] = calculateMinMaxSyntheticBorrowFromCollateral(
        inputCollateral,
        assetDetails!.collateralizationRatio!,
        assetDetails!.feePercentage!,
        assetDetails!.capDepositRatio!,
        assetDetails!.collateralTokenDecimals!,
        assetDetails!.positionTokens!,
        assetDetails!.positionCollateral!,
      );
      minSyntheticRef.current = min;
      maxSyntheticRef.current = max;
    } else if (
      collateralValue !== '' &&
      syntheticValue !== '' &&
      inputFocus === 'synthetic'
    ) {
      const inputSynthetic = FPN.toWei(maxSyntheticRef.current.format(6));

      const [max, min] = calculateMinMaxBorrowFromSynthetic(
        inputSynthetic,
        assetDetails!.collateralizationRatio!,
        assetDetails!.feePercentage!,
        assetDetails!.capDepositRatio!,
        assetDetails!.collateralTokenDecimals!,
        assetDetails!.positionTokens!,
        assetDetails!.positionCollateral!,
      );
      minCollateralRef.current = min;
      maxCollateralRef.current = max;
    }

    if (
      collateralValue !== '' &&
      inputFocus === 'collateral' &&
      (minCollateralRef.current.gt(new FPN(0)) ||
        maxCollateralRef.current.gt(new FPN(0)))
    ) {
      const inputCollateral = FPN.toWei(collateralValue.toString());
      const [minLimitLength] = numberLength(
        minCollateralRef.current.format(assetDetails.collateralTokenDecimals),
      );
      const [minInputLength] = numberLength(collateralValue);

      if (minLimitLength === minInputLength) {
        if (inputCollateral.lt(minCollateralRef.current)) {
          collateralError = errors.bmc;
          validInput = false;
        }
      }
      if (inputCollateral.gt(maxCollateralRef.current)) {
        collateralError = errors.cce;
        validInput = false;
      }
    }

    if (
      syntheticValue !== '' &&
      inputFocus === 'synthetic' &&
      (minSyntheticRef.current.gt(new FPN(0)) ||
        maxSyntheticRef.current.gt(new FPN(0)))
    ) {
      const inputSynthetic = FPN.toWei(syntheticValue.toString());
      const [minLimitLength] = numberLength(
        minSyntheticRef.current.format(assetDetails.syntheticTokenDecimals),
      );
      const [minInputLength] = numberLength(syntheticValue);
      if (minLimitLength === minInputLength) {
        if (inputSynthetic.lt(minSyntheticRef.current)) {
          syntheticError = errors.cce;
          validInput = false;
        }
      }
      if (inputSynthetic.gt(maxSyntheticRef.current)) {
        syntheticError = errors.bmc;
        validInput = false;
      }
    }

    /* -------------------------------------------------------------------------- */
    /*                                 Validation                                 */
    /* -------------------------------------------------------------------------- */

    if (collateralValue !== '' && syntheticValue !== '') {
      const inputCollateral = FPN.toWei(collateralValue.toString());
      const inputSynthetic = FPN.toWei(syntheticValue.toString());

      if (
        ((inputCollateral.gte(minCollateralRef.current) &&
          inputCollateral.lte(maxCollateralRef.current)) ||
          minCollateralRef.current.eq(maxCollateralRef.current)) &&
        ((inputSynthetic.gte(minSyntheticRef.current) &&
          inputSynthetic.lte(maxSyntheticRef.current)) ||
          minSyntheticRef.current.eq(maxSyntheticRef.current)) &&
        inputCollateral.gt(new FPN(0)) &&
        inputSynthetic.gt(new FPN(0))
      ) {
        validInput = true;
      } else {
        validInput = false;
      }
    }

    return {
      minSynthetic: minSyntheticRef.current,
      maxSynthetic: maxSyntheticRef.current,
      minCollateral: minCollateralRef.current,
      maxCollateral: maxCollateralRef.current,
      validInput,
      collateralError,
      syntheticError,
    };
  }, [syntheticValue, collateralValue]);
};
