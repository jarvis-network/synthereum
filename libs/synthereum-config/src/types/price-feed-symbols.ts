import {
  PerTupleElement,
  typeCheck,
} from '@jarvis-network/core-utils/dist/base/meta';

// primary definitions:

export const allCollateralSymbols = ['USDC', 'UMA'] as const;
export const synthereumCollateralSymbols = typeCheck<CollateralSymbol[]>()([
  allCollateralSymbols[0],
]);
export const selfMintingCollateralSymbols = typeCheck<CollateralSymbol[]>()([
  'UMA',
  'USDC',
]);

export const assetSymbols = [
  'EUR',
  'GBP',
  'CHF',
  'ZAR',
  'CAD',
  'KRW',
  'PHP',
  'JPY',
  'NGN',
  'XAU',
  'SPX',
  'XTI',
  'XAG',
  'SGD',
] as const;

export type PairLike<
  AssetType extends string,
  CollateralType extends string,
  Separator extends string = '/'
> = `${AssetType}${Separator}${CollateralType}`;

export type CollateralSymbol = typeof allCollateralSymbols[number];
export type SynthereumCollateralSymbol = typeof synthereumCollateralSymbols[number];
export type SelfMintingCollateralSymbol = typeof selfMintingCollateralSymbols[number];
export type AssetSymbol = typeof assetSymbols[number];
export type SyntheticSymbol = `j${AssetSymbol}`;
export type AnySynthereumPair = `${SyntheticSymbol}/${SynthereumCollateralSymbol}`;
export type AnySelfMintingPair = `${SyntheticSymbol}/${SelfMintingCollateralSymbol}`;

export type SynthereumPair = SyntheticToForexPair<
  AnySynthereumPair,
  'USDC',
  'USD',
  'j'
>;

export type SelfMintingPair =
  | SyntheticToForexPair<AnySelfMintingPair, 'UMA', 'UMA', 'j'>
  | SyntheticToForexPair<AnySelfMintingPair, 'USDC', 'USD', 'j'>;

export type PairToSynth<Pair extends string> = Pair extends `${infer Asset}${
  | 'USD'
  | SelfMintingCollateralSymbol}`
  ? `j${Asset}`
  : never;

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

type AdjustUsdc<Sym extends string> = Sym extends 'USD' ? 'USDC' : Sym;

// "EURUMA" | "EURUSD", "GBPUSD" | "GBPUMA" -> "jEUR/USDC" | "jEUR/UMA" | "jGBP/USDC" | "jGBP/UMA"
export type PairToExactPair<
  Pair extends string
> = Pair extends `${infer Asset}${SelfMintingCollateralSymbol | 'USD'}`
  ? Pair extends `${Asset}${infer Collateral}`
    ? `j${Asset}/${AdjustUsdc<Collateral>}`
    : never
  : never;

export type AssetOf<
  ExactPair extends string
> = ExactPair extends `j${infer Asset}/${SelfMintingCollateralSymbol}`
  ? Asset
  : never;

export type AssetFromSyntheticSymbol<
  ExactPair extends string
> = ExactPair extends `j${infer Asset}` ? Asset : never;

export type SyntheticSymbolOf<
  ExactPair extends string
> = ExactPair extends `j${infer Asset}/${SelfMintingCollateralSymbol}`
  ? `j${Asset}`
  : never;

export type CollateralOf<
  ExactPair extends string
> = ExactPair extends `j${AssetSymbol}/${infer Collateral}`
  ? Collateral
  : never;

// derived definitions:

export const primaryCollateralSymbol = synthereumCollateralSymbols[0];

export const allSyntheticSymbols = typeCheck<SyntheticSymbol[]>()([
  'jEUR',
  'jGBP',
  'jCHF',
  'jXAU',
  'jSPX',
  'jXTI',
  'jXAG',
  'jZAR',
  'jCAD',
  'jKRW',
  'jPHP',
  'jJPY',
  'jNGN',
  'jSGD',
] as const);

export const priceFeed = typeCheck<PriceFeed>()({
  jEUR: 'EURUSD',
  jGBP: 'GBPUSD',
  jCHF: 'USDCHF',
  jXAU: 'XAUUSD',
  jSPX: 'SPXUSD',
  jXTI: 'XTIUSD',
  jXAG: 'XAGUSD',
  jZAR: 'ZARUSD',
  jCAD: 'CADUSD',
  jKRW: 'KRWUSD',
  jPHP: 'PHPUSD',
  jJPY: 'JPYUSD',
  jNGN: 'NGNUSD',
  jSGD: 'SGDUSD',
} as const);

export const reversedPriceFeedPairs: string[] = [priceFeed.jCHF];
