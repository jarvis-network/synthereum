import { selfMintingMarketAssets } from '@/data/markets';
import { useReduxSelector } from '@/state/useReduxSelector';
import { FPN } from '@jarvis-network/core-utils/dist/base/fixed-point-number';
import { SupportedSelfMintingPairExact } from '@jarvis-network/synthereum-config/dist';
import { calculateDaoFee } from '@jarvis-network/synthereum-ts/dist/core/realms/self-minting/utils';
import { Market } from '@jarvis-network/synthereum-ts/dist/epics/markets';
import { useMemo } from 'react';

import {
  calculateBorrowLiquidationPrice,
  calculateBorrowNewCollateralizationRatio,
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
  syntheticValue: string,
  assetDetails: Market | null,
): Result => {
  const selectedAsset =
    selfMintingMarketAssets[
      assetDetails!.pair! as SupportedSelfMintingPairExact
    ];

  const collateralPrice = useReduxSelector(
    state => state.prices[selectedAsset.assetIn.name],
  );
  const syntheticPrice = useReduxSelector(
    state => state.prices[selectedAsset.pair],
  );
  return useMemo(() => {
    if (collateralValue === '' || syntheticValue === '') {
      return zero();
    }
    const inputCollateral = FPN.toWei(collateralValue.toString());
    const inputSynthetic = FPN.toWei(syntheticValue.toString());
    if (inputCollateral.eq(new FPN(0)) || inputSynthetic.eq(new FPN(0))) {
      return zero();
    }
    if (!assetDetails) {
      return zero();
    }
    return {
      newRatio: calculateBorrowNewCollateralizationRatio(
        assetDetails.positionCollateral!,
        assetDetails.positionTokens!,
        inputCollateral,
        inputSynthetic,
        assetDetails.feePercentage!,
        assetDetails.collateralizationRatio!,
        syntheticPrice!,
        collateralPrice!,
      ),
      liquidationPrice: calculateBorrowLiquidationPrice(
        assetDetails.collateralRequirement!,
        assetDetails.positionTokens!,
        inputSynthetic,
        assetDetails.positionCollateral!,
        inputCollateral,
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
  }, [syntheticValue, collateralValue]);
};
