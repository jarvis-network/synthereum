import { Rate } from '@/state/initialState';

import { useAssets } from './useAssets';

export const useRate = (
  inputSymbol: string | null,
  outputSymbol: string | null,
): Rate | null => {
  const assets = useAssets();

  if (!inputSymbol || !outputSymbol) {
    return null;
  }

  const inputAsset = assets.find(asset => asset.symbol === inputSymbol);
  const outputAsset = assets.find(asset => asset.symbol === outputSymbol);

  // asset not found or price not yet loaded
  if (!inputAsset || !outputAsset || !inputAsset.price || !outputAsset.price) {
    return null;
  }

  return {
    rate: outputAsset.price.div(inputAsset.price),
  };
};
