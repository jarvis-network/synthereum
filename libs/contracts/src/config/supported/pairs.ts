import { typeCheck } from '@jarvis-network/core-utils/dist/base/meta';

import {
  PairLike,
  ForexUsdPair,
  ForexPairToSynth,
} from '../types/price-feed-symbols';

import { PerNetwork, SupportedNetworkId } from './networks';

export type NetworkPairs<
  PairType extends PairLike<string, string, ''>
> = PerNetwork<PairType[]>;

export const supportedPairs = typeCheck<NetworkPairs<ForexUsdPair>>()({
  1: ['EURUSD', 'GBPUSD', 'CHFUSD'],
  42: ['EURUSD', 'GBPUSD', 'CHFUSD', 'XAUUSD'],
} as const);

export type SupportedPairs = typeof supportedPairs;

export type SupportedPair<
  Net extends SupportedNetworkId = SupportedNetworkId
> = SupportedPairs[Net][number];

export type SupportedSyntheticSymbol<
  Net extends SupportedNetworkId = SupportedNetworkId
> = ForexPairToSynth<SupportedPair<Net>>;

export type SupportedSyntheticSymbolExact<
  Net extends SupportedNetworkId = SupportedNetworkId
> = keyof {
  [N in Net]: {
    [X in SupportedSyntheticSymbol<N>]: unknown;
  };
}[Net];

export type PerPair<Net extends SupportedNetworkId, Config> = {
  [Pair in SupportedPairs[Net][number]]: Config;
};
