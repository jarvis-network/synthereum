import {
  ExchangeSynthereumToken,
  priceFeed as priceFeedPairsMap,
  primaryCollateralSymbol,
} from '@jarvis-network/synthereum-ts/dist/config';

import { useReduxSelector } from '@/state/useReduxSelector';
import { DataItem, PricePoint } from '@/state/initialState';

const reversePricePoint = (data: PricePoint) => ({
  ...data,
  open: 1 / data.open,
  high: 1 / data.high,
  low: 1 / data.low,
  close: 1 / data.close,
});

export const useFeedData = (
  payAsset: ExchangeSynthereumToken,
  receiveAsset: ExchangeSynthereumToken,
): DataItem[] => {
  if (
    payAsset === primaryCollateralSymbol ||
    receiveAsset === primaryCollateralSymbol
  ) {
    if (payAsset !== primaryCollateralSymbol) {
      const pair = priceFeedPairsMap[payAsset];

      return useReduxSelector(state => state.prices.feed[pair] || []);
    }

    if (receiveAsset !== primaryCollateralSymbol) {
      const pair = priceFeedPairsMap[receiveAsset];

      return useReduxSelector(state =>
        (state.prices.feed[pair] || []).map(reversePricePoint),
      );
    }

    return [];
  }

  const payPair = priceFeedPairsMap[payAsset];
  const receivePair = priceFeedPairsMap[receiveAsset];

  const { payData, receiveData } = useReduxSelector(state => {
    const pay = state.prices.feed[payPair] || [];
    const receive = state.prices.feed[receivePair] || [];

    return {
      payData: pay,
      receiveData: receive,
    };
  });

  const times = payData.map(i => i.time);

  return times.map(time => {
    const pay = payData.find(i => i.time === time);
    const receive = receiveData.find(i => i.time === time);

    if (!pay || !receive) {
      return {
        time,
        history: true,
      };
    }

    return {
      ...pay,
      open: pay.open / receive.open,
      high: pay.high / receive.high,
      low: pay.low / receive.low,
      close: pay.close / receive.close,
    };
  });
};
