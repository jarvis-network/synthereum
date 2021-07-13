import {
  PerTupleElement,
  typeCheck,
} from '@jarvis-network/core-utils/dist/base/meta';

// primary definitions:

export const allCollateralSymbols = ['USDC'] as const;
export const synthereumCollateralSymbols = typeCheck<'USDC'>()(
  allCollateralSymbols[0],
);
export const assetSymbols = [
  'EUR',
  'GBP',
  'CHF',
  'XAU',
  'SPX',
  'XTI',
  'XAG',
] as const;

export type PairLike<
  AssetType extends string,
  CollateralType extends string,
  Separator extends string = '/'
> = `${AssetType}${Separator}${CollateralType}`;

export type CollateralSymbol = typeof allCollateralSymbols[number];
export type SynthereumCollateralSymbol = typeof synthereumCollateralSymbols;
export type AssetSymbol = typeof assetSymbols[number];
export type SyntheticSymbol = `j${AssetSymbol}`;
export type ExchangeToken = SyntheticSymbol | CollateralSymbol;
export type AnySynthereumPair = `${SyntheticSymbol}/${SynthereumCollateralSymbol}`;

export type SynthereumPair = SyntheticToForexPair<
  AnySynthereumPair,
  'USDC',
  'USD',
  'j'
>;

export type PairToSynth<
  Pair extends string
> = Pair extends `${infer Asset}${'USD'}` ? `j${Asset}` : never;

export type SyntheticToForexPair<
  Pair extends string,
  Collateral extends string,
  CollateralReplacement extends string = Collateral,
  SyntheticPrefix extends string = 'j'
> = Pair extends `${SyntheticPrefix}${infer Asset}/${Collateral}`
  ? Asset extends Collateral
    ? never
    : `${Asset}${CollateralReplacement}`
  : never;

export type PerAsset<Config> = PerTupleElement<
  typeof allSyntheticSymbols,
  Config
>;

export type PriceFeed = PerAsset<string>;

// derived definitions:

export const primaryCollateralSymbol = synthereumCollateralSymbols;

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
