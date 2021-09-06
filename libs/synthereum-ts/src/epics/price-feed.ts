import {
  BehaviorSubject,
  tap,
  switchMap,
  switchMapTo,
  filter,
  map,
} from 'rxjs';
import {
  SupportedSelfMintingPairExact,
  SelfMintingCollateralSymbol,
} from '@jarvis-network/synthereum-config';

import { StringAmount } from '@jarvis-network/core-utils/dist/base/big-number';

import { dynamicInterval } from './interval';
import { Epic, ReduxAction } from './types';

export type PriceFeedSymbols =
  | SelfMintingCollateralSymbol
  | SupportedSelfMintingPairExact;

type SymbolPrice = {
  [key in PriceFeedSymbols]?: StringAmount;
};
export type OutputAction = ReduxAction<'UPDATE_PRICES', SymbolPrice>;

export type InputAction =
  | ReduxAction<'UPDATE_PAIRS', PriceFeedSymbols[]>
  | ReduxAction<'UPDATE_INTERVAL', number>
  | OutputAction;

const currentPairs = new BehaviorSubject<PriceFeedSymbols[]>(['UMA', 'USDC']);
export const { changeInterval, interval$ } = dynamicInterval(5000);

export const priceFeedEpic: Epic<ReduxAction, ReduxAction> = (
  action$,
  _state$,
  { context$ },
) =>
  action$.pipe(
    filter(
      action =>
        action.type === 'UPDATE_INTERVAL' || action.type === 'UPDATE_PAIRS',
    ),
    tap(action => {
      switch (action.type) {
        case 'UPDATE_PAIRS':
          currentPairs.next(action.payload!);
          break;
        case 'UPDATE_INTERVAL':
          changeInterval(action.payload!);
          break;
        default:
          break;
      }
    }),
    switchMapTo(interval$),
    switchMapTo(currentPairs),
    switchMap(pairs => context$!.pipe(map(core => ({ core, pairs })))),
    filter(({ core }) => !!core.chainLinkPriceFeed),
    switchMap(async ({ pairs, core }) => {
      try {
        return Object.fromEntries(
          await Promise.all(
            pairs.map(async p => [
              p,
              (await core.chainLinkPriceFeed!.getPrice(p))!,
            ]),
          ),
        ) as SymbolPrice;
      } catch (error) {
        console.log('Unable to load prices');
        return undefined;
      }
    }),
    map(results => ({
      type: 'prices/setCurrentPrice',
      payload: results,
    })),
  );
