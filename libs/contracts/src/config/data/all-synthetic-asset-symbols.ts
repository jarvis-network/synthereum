import { assert } from '@jarvis-network/web3-utils/base/asserts';
import { typeCheck, ValuesOf } from '@jarvis-network/web3-utils/base/meta';
import { PerNetwork } from '..';
import { SupportedNetworkId } from '../supported-networks';

const devNetworkId = 123;

export const enabledSymbols = typeCheck<PerNetwork<readonly string[]>>()({
  '42': ['jEUR', 'jGBP', 'jCHF', 'jXAU'] as const,
  '1': ['jEUR', 'jGBP'] as const,
  [devNetworkId]: [
    'jEUR',
    'jGBP',
    'jCHF',
    'jXAU',
    'jSPX',
    'jXTI',
    'jXAG',
  ] as const,
});

export type AnySyntheticSymbol = ValuesOf<typeof enabledSymbols>[number];
export type SupportedSymbol = typeof enabledSymbols[SupportedNetworkId][number];

const currentNetwork = 42; // FIXME
export const allSupportedSymbols = enabledSymbols[currentNetwork];
export type SyntheticSymbols = typeof allSupportedSymbols;
export type SyntheticSymbol = SyntheticSymbols[number];

export function isSyntheticSymbol(x: unknown): x is SyntheticSymbol {
  return allSupportedSymbols.includes(x as any);
}

export function assertIsSyntheticSymbol(x: unknown): SyntheticSymbol {
  assert(isSyntheticSymbol(x));
  return x as SyntheticSymbol;
}
