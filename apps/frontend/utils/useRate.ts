import { Rate } from '@/state/initialState';
import { useReduxSelector } from '@/state/useReduxSelector';

export const useRate = (
  inputSymbol: string | null,
  outputSymbol: string | null,
): Rate | null =>
  useReduxSelector(state => {
    if (!inputSymbol || !outputSymbol) {
      return null;
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
      rate: outputAsset.price.div(inputAsset.price),
    };
  });
