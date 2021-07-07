import { typeCheck } from '@jarvis-network/core-utils/dist/base/meta';
import { ToNetworkId } from '@jarvis-network/core-utils/dist/eth/networks';

import {
  PairLike,
  PairToSynth,
  SynthereumPair,
} from '../types/price-feed-symbols';

import { PerNetwork, SupportedNetworkName } from './networks';

export type NetworkPairs<
  PairType extends PairLike<string, string, ''>
> = PerNetwork<PairType[]>;

export const supportedPairs = typeCheck<NetworkPairs<SynthereumPair>>()({
  1: ['EURUSD', 'GBPUSD', 'CHFUSD'],
  42: ['EURUSD', 'GBPUSD', 'CHFUSD', 'XAUUSD'],
} as const);

export type SupportedPairs = typeof supportedPairs;

export type SupportedPair<
  Net extends SupportedNetworkName = SupportedNetworkName
> = SupportedPairs[ToNetworkId<Net>][number];

export type SupportedSyntheticSymbol<
  Net extends SupportedNetworkName = SupportedNetworkName
> = PairToSynth<SupportedPair<Net>>;

export type SupportedSyntheticSymbolExact<
  Net extends SupportedNetworkName = SupportedNetworkName
> = keyof {
  [N in Net]: {
    [X in SupportedSyntheticSymbol<N>]: unknown;
  };
}[Net];

export type PerPair<Net extends SupportedNetworkName, Config> = {
  [Pair in SupportedPairs[ToNetworkId<Net>][number]]: Config;
};
