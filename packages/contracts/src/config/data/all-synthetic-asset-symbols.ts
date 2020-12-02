export const allSymbols = [
  'jEUR',
  'jGBP',
  'jCHF',
  'jXAU',
  'jSPX',
  'jXTI',
  'jXAG',
] as const;

export type SyntheticSymbol = typeof allSymbols[number];
