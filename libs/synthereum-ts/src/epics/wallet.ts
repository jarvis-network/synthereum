import {
  map,
  switchMap,
  switchMapTo,
  filter,
  mapTo,
  takeUntil,
  distinctUntilChanged,
} from 'rxjs';
import {
  ExchangeSelfMintingToken,
  SupportedSelfMintingPairExact,
} from '@jarvis-network/synthereum-config';
import { StringAmount } from '@jarvis-network/core-utils/dist/base/big-number';

import { Dependencies, Epic, ReduxAction } from './types';
import { interval$ } from './price-feed';

export interface WalletBalance {
  asset: ExchangeSelfMintingToken;
  amount: StringAmount;
}

export type OutputAction = ReduxAction<
  'wallet/setWalletBalances',
  WalletBalance[]
>;

type SelectedWalletBalance = ReduxAction<
  'GET_WALLET_BALANCE',
  ExchangeSelfMintingToken[]
>;
export type InputAction = SelectedWalletBalance | OutputAction;

export type MinimalState = {
  markets: {
    manageKey: SupportedSelfMintingPairExact | null;
  };
};
export const walletEpic: Epic<ReduxAction, ReduxAction, MinimalState> = (
  action$,
  state$,
  { context$ }: Dependencies,
) =>
  action$.pipe(
    filter(action => action.type === 'GET_WALLET_BALANCE'),
    switchMapTo(state$.pipe(map(state => state.markets.manageKey))),
    distinctUntilChanged(),
    switchMap(symbol => interval$.pipe(mapTo(symbol))),
    switchMap(symbol =>
      context$!.pipe(
        map(context => ({ context, symbol })),
        takeUntil(
          action$.pipe(
            filter(
              a => a.type === 'networkSwitch' || a.type === 'addressSwitch',
            ),
          ),
        ),
      ),
    ),
    switchMap(async ({ context, symbol }) => {
      try {
        if (symbol && symbol.length > 0) {
          return await context.selfMintingRealmAgent?.getAllBalances(
            (symbol && symbol.split('/')) as ExchangeSelfMintingToken[],
          ); // eslint-disable-line
        }
        return await context.selfMintingRealmAgent?.getAllBalances(); // eslint-disable-line
      } catch (error) {
        return undefined;
      }
    }),
    map(results => ({
      type: 'wallet/setWalletBalances',
      payload:
        (results?.map(([asset, amount]) => ({
          asset,
          amount: amount.toString() as StringAmount,
        })) as WalletBalance[]) ?? [],
    })),
  );
