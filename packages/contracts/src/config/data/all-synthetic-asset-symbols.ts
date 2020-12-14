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
