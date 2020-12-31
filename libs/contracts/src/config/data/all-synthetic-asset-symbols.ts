export type AnySyntheticSymbol = [
  'jEUR',
  'jGBP',
  'jCHF',
  'jXAU',
  'jSPX',
  'jXTI',
  'jXAG',
][number];

export const allSupportedSymbols = ['jEUR', 'jGBP', 'jCHF', 'jXAU'] as const;

export type SyntheticSymbols = typeof allSupportedSymbols;
export type SyntheticSymbol = SyntheticSymbols[number];
