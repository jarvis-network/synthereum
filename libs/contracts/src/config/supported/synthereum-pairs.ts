import { typeCheck } from '@jarvis-network/core-utils/dist/base/meta';
import { ToNetworkId } from '@jarvis-network/core-utils/dist/eth/networks';

import {
  PairLike,
  PairToSynth,
  SynthereumPair,
  SynthereumCollateralSymbol,
} from '../types/price-feed-symbols';

import { PerNetwork, SupportedNetworkName } from './networks';

export type NetworkPairs<
  PairType extends PairLike<string, string, ''>
> = PerNetwork<PairType[]>;

export const supportedSynthereumPairs = typeCheck<
  NetworkPairs<SynthereumPair>
>()({
  1: ['EURUSD', 'GBPUSD', 'CHFUSD'],
  42: ['EURUSD', 'GBPUSD', 'CHFUSD', 'XAUUSD'],
} as const);

export type SupportedSynthereumPairs = typeof supportedSynthereumPairs;

export type SupportedSynthereumPair<
  Net extends SupportedNetworkName = SupportedNetworkName
> = SupportedSynthereumPairs[ToNetworkId<Net>][number];

export type SupportedSynthereumSymbol<
  Net extends SupportedNetworkName = SupportedNetworkName
> = PairToSynth<SupportedSynthereumPair<Net>>;

export type SupportedSynthereumSymbolExact<
  Net extends SupportedNetworkName = SupportedNetworkName
> = keyof {
  [N in Net]: {
    [X in SupportedSynthereumSymbol<N>]: unknown;
  };
}[Net];

export type PerPair<Net extends SupportedNetworkName, Config> = {
  [Pair in SupportedSynthereumPairs[ToNetworkId<Net>][number]]: Config;
};

export type ExchangeSynthereumToken =
  | SupportedSynthereumSymbol
  | SynthereumCollateralSymbol;

export type PerSynthereumPair<
  Config,
  Net extends SupportedNetworkName = SupportedNetworkName
> = {
  [Pair in PairToSynth<
    SupportedSynthereumPairs[ToNetworkId<Net>][number]
  >]: Config;
};
