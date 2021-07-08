import { typeCheck } from '@jarvis-network/core-utils/dist/base/meta';
import { ToNetworkId } from '@jarvis-network/core-utils/dist/eth/networks';

import {
  PairLike,
  PairToSynth,
  SelfMintingPair,
} from '../types/price-feed-symbols';

import { PerNetwork, SupportedNetworkName } from './networks';

export type NetworkPairs<
  PairType extends PairLike<string, string, ''>
> = PerNetwork<PairType[]>;

export const supportedSelfMintingPairs = typeCheck<
  NetworkPairs<SelfMintingPair>
>()({
  1: [
    // UMA-based
    'CADUMA',
    'CHFUMA',
    'EURUMA',
    'GBPUMA',
    'JPYUMA',
    'KRWUMA',
    'NGNUMA',
    'PHPUMA',
    'ZARUMA',

    // USDC-based
    'CADUSD',
    'CHFUSD',
    'EURUSD',
    'GBPUSD',
    'JPYUSD',
    'KRWUSD',
    'NGNUSD',
    'PHPUSD',
    'ZARUSD',
  ],
  42: [
    // UMA-based
    'CADUMA',
    'CHFUMA',
    'EURUMA',
    'GBPUMA',
    'JPYUMA',
    'KRWUMA',
    'NGNUMA',
    'PHPUMA',
    'ZARUMA',

    // USDC-based
    'CADUSD',
    'CHFUSD',
    'EURUSD',
    'GBPUSD',
    'JPYUSD',
    'KRWUSD',
    'NGNUSD',
    'PHPUSD',
    'ZARUSD',
  ],
} as const);

export type SupportedSelfMintingPairs = typeof supportedSelfMintingPairs;

export type SupportedSelfMintingPair<
  Net extends SupportedNetworkName = SupportedNetworkName
> = SupportedSelfMintingPairs[ToNetworkId<Net>][number];

export type SupportedSelfMintingSymbol<
  Net extends SupportedNetworkName = SupportedNetworkName
> = PairToSynth<SupportedSelfMintingPair<Net>>;

export type SupportedSelfMintingSymbolExact<
  Net extends SupportedNetworkName = SupportedNetworkName
> = keyof {
  [N in Net]: {
    [X in SupportedSelfMintingSymbol<N>]: unknown;
  };
}[Net];

export type ExchangeSelfMintingToken = SupportedSelfMintingSymbol;

export type PerSelfMintingPair<
  Config,
  Net extends SupportedNetworkName = SupportedNetworkName
> = {
  [Pair in SupportedSelfMintingPairs[ToNetworkId<Net>][number]]: Config;
};
