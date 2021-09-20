import { selfMintingMarketAssets } from '@/data/markets';
import { useReduxSelector } from '@/state/useReduxSelector';
import { FPN } from '@jarvis-network/core-utils/dist/base/fixed-point-number';
import { SupportedSelfMintingPairExact } from '@jarvis-network/synthereum-config/dist';
import { Market } from '@jarvis-network/synthereum-ts/dist/epics/markets';
import { useMemo } from 'react';

import {
  calculateDepositLiquidationPrice,
  calculateDepositNewCollateralizationRatio,
} from '../helpers/MinMax';

interface Result {
  newRatio: FPN;
  fee: FPN;
  liquidationPrice: FPN;
}

const zero = (): Result => ({
  newRatio: new FPN(0),
  liquidationPrice: new FPN(0),
  fee: new FPN(0),
});
export const useCalculateUserCollateralizationRatioLiquiationpriceFee = (
  collateralValue: string,
  assetDetails: Market | null,
): Result => {
  const selectedAsset =
    selfMintingMarketAssets[
      assetDetails!.pair! as SupportedSelfMintingPairExact
    ];

  const syntheticPrice = useReduxSelector(
    state => state.prices[selectedAsset.pair],
  );
  const collateralPrice = useReduxSelector(
    state => state.prices[selectedAsset.assetIn.name],
  );
  return useMemo(() => {
    if (collateralValue === '') {
      return zero();
    }
    const inputCollateral = FPN.toWei(collateralValue.toString());
    if (inputCollateral.eq(new FPN(0))) {
      return zero();
    }
    if (!assetDetails) {
      return zero();
    }
    return {
      newRatio: calculateDepositNewCollateralizationRatio(
        assetDetails!.positionCollateral!,
        assetDetails!.positionTokens!,
        inputCollateral,
        syntheticPrice!,
        collateralPrice!,
      ),
      liquidationPrice: calculateDepositLiquidationPrice(
        assetDetails!.collateralRequirement!,
        assetDetails!.positionTokens!,
        inputCollateral,
        assetDetails!.positionCollateral!,
        syntheticPrice!,
      ),
      fee: new FPN(0),
    };
  }, [collateralValue]);
};
