import {
  PerTupleElement,
  typeCheck,
} from '@jarvis-network/core-utils/dist/base/meta';

// primary definitions:

export const collateralSymbols = ['USDC'] as const;
export const usdCollateral = typeCheck<'USDC'>()(collateralSymbols[0]);
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

export type CollateralSymbol = typeof collateralSymbols[number];
export type UsdCollateralSymbol = typeof usdCollateral;
export type AssetSymbol = typeof assetSymbols[number];
export type SyntheticSymbol = `j${AssetSymbol}`;
export type ExchangeToken = SyntheticSymbol | CollateralSymbol;
export type SynthereumPair = `${SyntheticSymbol}/${CollateralSymbol}`;
export type ForexUsdPair = SyntheticToForexPair<
  SynthereumPair,
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

export const primaryCollateralSymbol = usdCollateral;

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
