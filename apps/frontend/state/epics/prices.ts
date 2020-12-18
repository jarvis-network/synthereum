import { Epic, ofType } from 'redux-observable';
import { fromEvent, iif, of } from 'rxjs';
import { map, mergeMap, concatMap } from 'rxjs/operators';

import { indexOfMaxLexicographicalValue } from '@jarvis-network/web3-utils/base/array-fp-utils';
import { syntheticTokens } from '@jarvis-network/synthereum-contracts/dist/src/config/data/all-synthetic-assets';

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

function getPricesMapFromPriceUpdate({ t, ...data }: PriceUpdate): PricesMap {
  return data;
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
    const [, , , close] = data[key][maxTimeIndex];

    return {
      ...result,
      [key]: close,
    };
  }, {} as PricesMap);
}

const AllAssets = syntheticTokens.map(i => i.syntheticSymbol);

export const priceFeedSubscribeEpic: Epic<
  ReturnType<typeof subscribeAllPrices>,
  any,
  never,
  Dependencies
> = (action$, _state$, dependencies$) =>
  action$.pipe(
    ofType(subscribeAllPrices.type),
    map(() =>
      dependencies$.priceFeed.subscribeMany(AllAssets, {
        includeHistory: true,
      }),
    ),
    concatMap(socket =>
      fromEvent(socket, 'message').pipe(
        map(event => {
          return JSON.parse(
            (event as MessageEvent<string>).data,
          ) as PriceMessage;
        }),
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
