import {
  collateralSymbol,
  PerAsset,
  synthereumConfig,
  allSyntheticSymbols,
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
  icon: 'usdc',
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
  jEUR: 'jeur',
  jGBP: 'jgbp',
  jCHF: 'jchf',
  jXAU: 'jxau',
  jXAG: null,
  jXTI: null,
  jSPX: null,
  jPHP: 'jphp',
  jSGD: 'jsgd',
  jCAD: 'jcad',
} as const;

type SynthereumConfig = typeof synthereumConfig;
type PolygonSyntheticTokens = SynthereumConfig[137]['perVersionConfig']['v4']['syntheticTokens'];
type MainnetSyntheticTokens = SynthereumConfig[1]['perVersionConfig']['v4']['syntheticTokens'];
type KovanSyntheticTokens = SynthereumConfig[42]['perVersionConfig']['v4']['syntheticTokens'];
type MumbaiSyntheticTokens = SynthereumConfig[80001]['perVersionConfig']['v4']['syntheticTokens'];
type SyntheticToken =
  | PolygonSyntheticTokens[keyof PolygonSyntheticTokens]
  | MainnetSyntheticTokens[keyof MainnetSyntheticTokens]
  | KovanSyntheticTokens[keyof KovanSyntheticTokens]
  | MumbaiSyntheticTokens[keyof MumbaiSyntheticTokens];

function mapSyntheticAssets(info: SyntheticToken) {
  return {
    name: info.syntheticName,
    symbol: info.syntheticSymbol,
    pair: info.jarvisPriceFeedIdentifier,
    icon: assetIconMap[info.syntheticSymbol],
    price: null,
    decimals: 18,
    type: 'forex',
    synthetic: true,
  } as Asset;
}
// FIXME: Instead of hardcoding the networkId and pool version make them dynamic
const syntheticAssets = Object.values(
  synthereumConfig[1].perVersionConfig.v4.syntheticTokens,
).map(mapSyntheticAssets);
const syntheticAssetsPolygon = Object.values(
  synthereumConfig[137].perVersionConfig.v4.syntheticTokens,
).map(mapSyntheticAssets);

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

const common: Asset[] = [
  {
    name: 'Wrapped Bitcoin',
    symbol: 'WBTC',
    icon: 'wbtc',
    decimals: 8,
    type: 'crypto',
  },
  {
    name: 'UMA Token',
    symbol: 'UMA',
    icon: 'uma',
    decimals: 18,
    type: 'crypto',
  },
  {
    name: 'Aave Token',
    symbol: 'AAVE',
    icon: 'aave',
    decimals: 18,
    type: 'crypto',
  },
  {
    name: 'Jarvis Reward Token',
    symbol: 'JRT',
    icon: 'jrt',
    decimals: 18,
    type: 'crypto',
  },
  {
    name: 'ChainLink Token',
    symbol: 'LINK',
    icon: 'link',
    decimals: 18,
    type: 'crypto',
  },
  {
    name: 'QuickSwap',
    symbol: 'QUICK',
    icon: 'quick',
    decimals: 18,
    type: 'crypto',
  },
  {
    name: 'SushiToken',
    symbol: 'SUSHI',
    icon: 'sushi',
    decimals: 18,
    type: 'crypto',
  },
];

export const assets: Asset[] = [
  PRIMARY_STABLE_COIN,
  ...syntheticAssets,
  { ...eth, native: true },
  ...common,
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
  ...syntheticAssetsPolygon,
  ...common,
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

export const polygonOnlyAssets: typeof allSyntheticSymbols[number][] = [
  'jPHP',
  'jSGD',
  'jCAD',
];
