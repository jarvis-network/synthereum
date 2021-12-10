import { BehaviorSubject, Observable } from 'rxjs';
import type { Epic as RoEpic } from 'redux-observable';

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

export type Epic<
  Input extends ReduxAction,
  Output extends Input,
  State = unknown
> = RoEpic<Input, Output, State, Dependencies>;

export interface Dependencies {
  context$: BehaviorSubject<Context> | null;
}
