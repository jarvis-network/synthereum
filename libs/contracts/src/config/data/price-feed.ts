import { SyntheticSymbol } from '..';
import { typeCheck } from '@jarvis-network/web3-utils/base/meta';

export type PriceFeed = {
  [sym in SyntheticSymbol]: string;
};

export const priceFeed = typeCheck<PriceFeed>()({
  jEUR: 'EURUSD',
  jGBP: 'GBPUSD',
  jCHF: 'USDCHF',
  jXAU: 'XAUUSD',
  jSPX: 'SPXUSD',
  jXTI: 'XTIUSD',
  jXAG: 'XAGUSD',
} as const);

export const reversedPriceFeedPairs: string[] = [
  priceFeed.jCHF
];
