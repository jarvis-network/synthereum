import {
  PerTupleElement,
  typeCheck,
} from '@jarvis-network/core-utils/dist/base/meta';

// primary definitions:

export const collateralSymbols = ['USDC'] as const;
export const assetSymbols = [
  'EUR',
  'GBP',
  'CHF',
  'XAU',
  'SPX',
  'XTI',
  'XAG',
] as const;

export type CollateralSymbol = typeof collateralSymbols[number];
export type AssetSymbol = typeof assetSymbols[number];
export type SyntheticSymbol = `j${AssetSymbol}`;
export type ExchangeToken = SyntheticSymbol | CollateralSymbol;

export type PerAsset<Config> = PerTupleElement<
  typeof allSyntheticSymbols,
  Config
>;

export type PriceFeed = PerAsset<string>;

// utility definitions:

export const primaryCollateralSymbol = collateralSymbols[0];

export const allSyntheticSymbols = typeCheck<SyntheticSymbol[]>()([
  'jEUR',
  'jGBP',
  'jCHF',
  'jXAU',
  'jSPX',
  'jXTI',
  'jXAG',
] as const);

export const priceFeed = typeCheck<PriceFeed>()({
  jEUR: 'EURUSD',
  jGBP: 'GBPUSD',
  jCHF: 'USDCHF',
  jXAU: 'XAUUSD',
  jSPX: 'SPXUSD',
  jXTI: 'XTIUSD',
  jXAG: 'XAGUSD',
} as const);

export const reversedPriceFeedPairs: string[] = [priceFeed.jCHF];
