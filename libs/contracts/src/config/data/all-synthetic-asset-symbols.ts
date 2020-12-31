import { typeCheck, ValuesOf } from '@jarvis-network/web3-utils/base/meta';
import { PerNetwork } from '..';
import { SupportedNetworkId } from '../supported-networks';

const devNetworkId = 123;

export const enabledSymbols = typeCheck<PerNetwork<readonly string[]>>()({
  '42': ['jEUR', 'jGBP', 'jCHF', 'jXAU'] as const,
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
