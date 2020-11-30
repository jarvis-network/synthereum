import { wei } from '@jarvis-network/web3-utils/base/big-number';
import { AssetFunding } from '../types';

export const fundAssets: AssetFunding[] = [
  {
    syntheticSymbol: 'jEUR',
    amount: wei('100000000'),
  },
  {
    syntheticSymbol: 'jGBP',
    amount: wei('100000000'),
  },
  {
    syntheticSymbol: 'jCHF',
    amount: wei('100000000'),
  },
  {
    syntheticSymbol: 'jXAU',
    amount: wei('100000000'),
  },
  {
    syntheticSymbol: 'jSPX',
    amount: wei('100000000'),
  },
  {
    syntheticSymbol: 'jXTI',
    amount: wei('100000000'),
  },
  {
    syntheticSymbol: 'jXAG',
    amount: wei('100000000'),
  },
];
