import { assert, isString } from '@jarvis-network/web3-utils/base/asserts';

export const allSymbols = [
  'jEUR',
  'jGBP',
  'jCHF',
  'jXAU',
  'jSPX',
  'jXTI',
  'jXAG',
] as const;

export type SyntheticSymbols = typeof allSymbols;
export type SyntheticSymbol = SyntheticSymbols[number];

export function isSyntheticSymbol(x: unknown): x is SyntheticSymbol {
  return isString(x) && allSymbols.indexOf(x as SyntheticSymbol) > -1;
}

export function assertIsSyntheticSymbol(x: unknown): SyntheticSymbol {
  assert(isSyntheticSymbol(x));
  return x as SyntheticSymbol;
}
