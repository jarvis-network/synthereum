import { typeCheck } from '@jarvis-network/core-utils/dist/base/meta';

import {
  PerSelfMintingPair,
  PerSelfMintingCollateralPair,
} from '@jarvis-network/synthereum-config';

interface Expression {
  simple: string;
  inverted?: string;
}
export type SyntheticPriceExpression =
  | PerSelfMintingPair<Expression>
  | PerSelfMintingCollateralPair<Expression>;

const common = {
  'jCAD/UMA': {
    simple: 'CADUSD * (1/ETHUSD) * (1/UMAETH)',
  },
  'jGBP/UMA': {
    simple: 'GBPUSD * (1/ETHUSD) * (1/UMAETH)',
  },
  'jCHF/UMA': {
    simple: 'CHFUSD * (1/ETHUSD) * (1/UMAETH)',
  },
  'jEUR/UMA': {
    simple: '(EURUSD / (ETHUSD * UMAETH))',
  },
  'jZAR/UMA': {
    simple: 'ZARUSD * (1/ETHUSD) * (1/UMAETH)',
  },
  'jPHP/UMA': {
    simple: 'PHPUSD * (1/ETHUSD) * (1/UMAETH)',
  },
  'jNGN/UMA': {
    simple: 'NGNUSD * (1/ETHUSD) * (1/UMAETH)',
  },
  'jKRW/UMA': {
    simple: 'KRWUSD * (1/ETHUSD) * (1/UMAETH)',
  },
  'jJPY/UMA': {
    simple: 'JPYUSD * (1/ETHUSD) * (1/UMAETH)',
  },
  UMA: {
    simple: 'ETHUSD * UMAETH',
  },

  // USDC-based
  'jCAD/USDC': {
    simple: 'CADUSD',
  },
  'jGBP/USDC': {
    simple: 'GBPUSD',
  },
  'jCHF/USDC': {
    simple: 'CHFUSD',
  },
  'jEUR/USDC': {
    simple: 'EURUSD',
  },
  'jZAR/USDC': {
    simple: 'ZARUSD',
  },
  'jPHP/USDC': {
    simple: 'PHPUSD',
  },
  'jNGN/USDC': {
    simple: 'NGNUSD',
  },
  'jKRW/USDC': {
    simple: 'KRWUSD',
  },
  'jJPY/USDC': {
    simple: 'JPYUSD',
  },
  USDC: {
    simple: '1',
  },
};
export const syntheticPriceExpression = typeCheck<SyntheticPriceExpression>()({
  1: {
    // UMA-based
    ...common,
  },
  42: {
    ...common,
    'jGBP/UMA': {
      simple: 'GBPUSD * (1/ETHUSD) * 10',
    },
    'jCHF/UMA': {
      simple: 'CHFUSD * (1/ETHUSD) * 10',
    },
    'jEUR/UMA': {
      simple: 'EURUSD * (1/ETHUSD) * 10',
    },
    UMA: {
      simple: '9.2',
    },
  },
  137: {
    ...common,
  },
} as const);
