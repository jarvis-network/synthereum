import { typeCheck } from '@jarvis-network/core-utils/dist/base/meta';
import { ToNetworkId } from '@jarvis-network/core-utils/dist/eth/networks';

import {
  PairLike,
  PairToExactPair,
  PairToSynth,
  SelfMintingCollateralSymbol,
  SelfMintingPair,
} from '../types/price-feed-symbols';

import {
  PerNetwork,
  SupportedNetworkId,
  SupportedNetworkName,
} from './networks';

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

export type SupportedSelfMintingPairExact<
  Net extends SupportedNetworkName = SupportedNetworkName
> = PairToExactPair<SupportedSelfMintingPair<Net>>;

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
export type x = SupportedSelfMintingPairExact;
export type ExchangeSelfMintingToken =
  | SupportedSelfMintingSymbol
  | SelfMintingCollateralSymbol;

export type PerSelfMintingPair<Config> = {
  [N in SupportedNetworkId]: {
    [Pair in SupportedSelfMintingPairExact[N][number]]: Config;
  };
};

export type PerSelfMintingCollateralPair<Config> = {
  [N in SupportedNetworkId]: {
    [Pair in SelfMintingCollateralSymbol]: Config;
  };
};
