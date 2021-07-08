import { Epic, ofType } from 'redux-observable';
import { fromEvent, of } from 'rxjs';
import { map, mergeMap, concatMap } from 'rxjs/operators';

import { indexOfMaxLexicographicalValue } from '@jarvis-network/core-utils/dist/base/array-fp-utils';
import { reversedPriceFeedPairs } from '@jarvis-network/synthereum-ts/dist/config';

import { Dependencies } from '@/utils/epics';
import {
  PriceUpdate,
  HistoricalPrices,
  PriceMessage,
  SubscriptionPair,
  PricesMap,
} from '@/utils/priceFeed';
import {
  addHistory,
  addPriceUpdate,
  subscribeAllPrices,
  closeConnection,
} from '@/state/slices/prices';
import { setAssetsPrice } from '@/state/slices/assets';
import { supportedSynthereumPairs } from '@jarvis-network/synthereum-contracts/dist/config';

const isPairReversed = (pair: SubscriptionPair) =>
  reversedPriceFeedPairs.includes(pair);

function getPricesMapFromPriceUpdate({
  t: _,
  ...data
}: PriceUpdate): PricesMap {
  const keys = Object.keys(data) as SubscriptionPair[];

  return keys.reduce((result, key) => {
    const isReversed = isPairReversed(key);
    const value = data[key];

    return {
      ...result,
      [key]: isReversed ? 1 / value : value,
    };
  }, {} as PricesMap);
}

function getPricesMapFromHistoricalPrices({
  t,
  ...data
}: HistoricalPrices): PricesMap {
  const maxTimeIndex = indexOfMaxLexicographicalValue(t);
  if (maxTimeIndex === -1) {
    throw new Error('maxTimeIndex === -1');
  }
  const keys = Object.keys(data) as SubscriptionPair[];

  return keys.reduce((result, key) => {
    const isReversed = isPairReversed(key);
    const [, , , close] = data[key][maxTimeIndex];

    return {
      ...result,
      [key]: isReversed ? 1 / close : close,
    };
  }, {} as PricesMap);
}

export const priceFeedSubscribeEpic: Epic<
  ReturnType<typeof subscribeAllPrices>,
  any,
  never,
  Dependencies
> = (action$, _state$, dependencies$) =>
  action$.pipe(
    ofType(subscribeAllPrices.type),
    map(() =>
      dependencies$.priceFeed.subscribeMany(supportedSynthereumPairs[1], {
        includeHistory: true,
      }),
    ),
    concatMap(socket =>
      fromEvent(socket, 'message').pipe(
        map(
          event =>
            JSON.parse((event as MessageEvent<string>).data) as PriceMessage,
        ),
        mergeMap(data => {
          const isHistory = Array.isArray(data.t);

          if (isHistory) {
            return of(
              addHistory(data as HistoricalPrices),
              setAssetsPrice(
                getPricesMapFromHistoricalPrices(data as HistoricalPrices),
              ),
            );
          }

          return of(
            addPriceUpdate(data as PriceUpdate),
            setAssetsPrice(getPricesMapFromPriceUpdate(data as PriceUpdate)),
          );
        }),
      ),
    ),
  );

export const priceFeedUnsubscribeEpic: Epic<
  ReturnType<typeof closeConnection>,
  any,
  never,
  Dependencies
> = (action$, _state$, dependencies$) =>
  action$.pipe(
    ofType(closeConnection.type),
    map(dependencies$.priceFeed.closeConnection),
  );
