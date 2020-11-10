import { Rate } from '@/state/initialState';
import { useReduxSelector } from '@/state/useReduxSelector';

export const useRate = (
  inputSymbol: string,
  outputSymbol: string,
): Rate | null => {
  return useReduxSelector(state => {
    if (!inputSymbol || !outputSymbol) {
      return null;
    }

    if (inputSymbol === outputSymbol) {
      // should not happen, but left just in case, to avoid crashing UI
      return {
        rate: 1,
      };
    }

    const inputAsset = state.assets.list.find(
      asset => asset.symbol === inputSymbol,
    );
    const outputAsset = state.assets.list.find(
      asset => asset.symbol === outputSymbol,
    );

    // asset not found or price not yet loaded
    if (
      !inputAsset ||
      !outputAsset ||
      !inputAsset.price ||
      !outputAsset.price
    ) {
      return null;
    }

    return {
      rate: outputAsset.price / inputAsset.price,
    };
  });
};
