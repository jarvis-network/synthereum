import { Rate } from '@/state/initialState';
import { useReduxSelector } from '@/state/useReduxSelector';

export const useRate = (
  paySymbol: string,
  receiveSymbol: string,
): Rate | null => {
  return useReduxSelector(state => {
    if (!paySymbol || !receiveSymbol) {
      return null;
    }

    if (paySymbol === receiveSymbol) {
      return {
        rate: 1,
      };
    }

    const rate = state.assets.rates[`${paySymbol}/${receiveSymbol}`];
    if (rate) {
      return rate;
    }

    const invertedRate = state.assets.rates[`${receiveSymbol}/${paySymbol}`];
    if (invertedRate) {
      return {
        ...invertedRate,
        rate: 1 / invertedRate.rate,
      };
    }

    return null;
  });
};
