import { BehaviorSubject, Observable } from 'rxjs';

import type Web3 from 'web3';

import { SupportedNetworkName } from '../config';

import { SelfMintingRealmAgent } from '../core/realms/self-minting/agent';
import { SelfMintingRealmWithWeb3 } from '../core/types/realm';
import { ChainLinkPriceFeed } from '../price-feed/chainlink';

export interface Context {
  web3: Web3 | null;
  selfMintingRealmAgent: SelfMintingRealmAgent | null;
  networkId: number | null;
  chainLinkPriceFeed: ChainLinkPriceFeed | null;
  realm: SelfMintingRealmWithWeb3<SupportedNetworkName> | null;
}

export const context$ = new BehaviorSubject<Context>({
  networkId: null,
  selfMintingRealmAgent: null,
  chainLinkPriceFeed: null,
  web3: null,
  realm: null,
});
export type ReduxAction<Type extends string = string, Payload = any> = {
  type: Type;
  payload?: Payload;
};

export interface StateObservable<S> extends Observable<S> {
  value: S;
}

export declare interface Epic<
  Input extends ReduxAction,
  Output extends ReduxAction,
  State = unknown
> {
  (
    action$: Observable<Input>,
    state$: StateObservable<State>,
    dependencies: Dependencies,
  ): Observable<Output>;
}

export interface Dependencies {
  context$: BehaviorSubject<Context> | null;
}
