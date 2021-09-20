import { selfMintingMarketAssets } from '@/data/markets';
import { useReduxSelector } from '@/state/useReduxSelector';
import { FPN } from '@jarvis-network/core-utils/dist/base/fixed-point-number';
import { SupportedSelfMintingPairExact } from '@jarvis-network/synthereum-config/dist';
import { calculateDaoFee } from '@jarvis-network/synthereum-ts/dist/core/realms/self-minting/utils';
import { Market } from '@jarvis-network/synthereum-ts/dist/epics/markets';
import { useMemo } from 'react';

import {
  calculateRepayLiquidationPrice,
  calculateRepayNewCollateralizationRatio,
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
  syntheticValue: string,
  assetDetails: Market | null,
): Result => {
  const selectedAsset =
    selfMintingMarketAssets[
      assetDetails!.pair! as SupportedSelfMintingPairExact
    ];

  const syntheticPrice = useReduxSelector(
    state => state.prices[selectedAsset.pair],
  );
  return useMemo(() => {
    if (syntheticValue === '') {
      return zero();
    }
    const inputSynthetic = FPN.toWei(syntheticValue.toString());
    if (inputSynthetic.eq(new FPN(0))) {
      return zero();
    }
    if (!assetDetails) {
      return zero();
    }
    return {
      newRatio: calculateRepayNewCollateralizationRatio(
        assetDetails.positionCollateral!,
        assetDetails.positionTokens!,
        inputSynthetic,
        assetDetails.feePercentage!,
        assetDetails.collateralizationRatio!,
        syntheticPrice!,
      ),
      liquidationPrice: calculateRepayLiquidationPrice(
        assetDetails.collateralRequirement!,
        assetDetails.positionTokens!,
        inputSynthetic,
        assetDetails.positionCollateral!,
        syntheticPrice!,
        assetDetails.collateralizationRatio!,
        assetDetails.feePercentage!,
      ),
      fee: calculateDaoFee({
        collateral: inputSynthetic,
        collateralizationRatio: assetDetails.collateralizationRatio!,
        feePercentage: assetDetails.feePercentage!,
      }),
    };
  }, [syntheticValue]);
};
