import {
  collateralSymbol,
  PerAsset,
  synthereumConfig,
} from '@jarvis-network/synthereum-ts/dist/config';
import { FPN } from '@jarvis-network/core-utils/dist/base/fixed-point-number';

import { SubscriptionPair } from '@/utils/priceFeed';

export interface Asset {
  name: string;
  symbol: string;
  pair?: SubscriptionPair;
  icon?: string;
  decimals: number;
  type: 'forex' | 'crypto';
  native?: true;
  wrappedNative?: true;
  synthetic?: true;
  collateral?: true;
}

export interface AssetPair {
  input: Asset;
  inputPrice?: FPN;
  output: Asset;
  outputPrice?: FPN;
  name: string;
}

export const PRIMARY_STABLE_COIN_TEXT_SYMBOL = '$';

export const PRIMARY_STABLE_COIN: Asset = {
  name: 'USDC',
  symbol: collateralSymbol,
  icon: 'us',
  decimals: 6,
  type: 'forex',
  collateral: true,
};

export interface AssetWithWalletInfo extends Asset {
  price: FPN | null;
  stableCoinValue: FPN | null;
  ownedAmount: FPN;
}

const assetIconMap: PerAsset<string | null> = {
  jEUR: 'eur',
  jGBP: 'gbp',
  jCHF: 'chf',
  jXAU: 'xau',
  jXAG: null,
  jXTI: null,
  jSPX: null,
} as const;

// FIXME: Instead of hardcoding the networkId and pool version make them dynamic
const syntheticAssets = Object.values(
  synthereumConfig[1].perVersionConfig.v4.syntheticTokens,
).map(
  info =>
    ({
      name: info.syntheticName,
      symbol: info.syntheticSymbol,
      pair: info.jarvisPriceFeedIdentifier,
      icon: assetIconMap[info.syntheticSymbol],
      price: null,
      decimals: 18,
      type: 'forex',
      synthetic: true,
    } as Asset),
);

const eth = {
  name: 'Ether',
  symbol: 'ETH',
  icon: 'eth',
  decimals: 18,
  type: 'crypto',
} as Asset;

const matic = {
  name: 'Matic',
  symbol: 'MATIC',
  icon: 'matic',
  decimals: 18,
  type: 'crypto',
} as Asset;

export const assets: Asset[] = [
  PRIMARY_STABLE_COIN,
  ...syntheticAssets,
  {
    name: 'Wrapped Bitcoin',
    symbol: 'WBTC',
    icon: 'wbtc',
    decimals: 8,
    type: 'crypto',
  } as Asset,
  { ...eth, native: true },
  {
    name: 'Wrapped Ether',
    symbol: 'WETH',
    icon: 'weth',
    decimals: 18,
    type: 'crypto',
    wrappedNative: true,
  } as Asset,
  matic,
];

export const assetsPolygon: Asset[] = [
  PRIMARY_STABLE_COIN,
  ...syntheticAssets,
  {
    name: 'Wrapped Bitcoin',
    symbol: 'WBTC',
    icon: 'wbtc',
    decimals: 8,
    type: 'crypto',
  } as Asset,
  eth,
  { ...matic, native: true },
  {
    name: 'Wrapped Matic',
    symbol: 'WMATIC',
    icon: 'wmatic',
    decimals: 18,
    type: 'crypto',
    wrappedNative: true,
  } as Asset,
];
