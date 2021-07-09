import { typeCheck } from '@jarvis-network/core-utils/dist/base/meta';

import { PerSelfMintingPair } from '@jarvis-network/synthereum-contracts/dist/config';

interface Expression {
  simple: string;
  inverted?: string;
}
export type SyntheticPriceExpression = PerSelfMintingPair<Expression>;

export const syntheticPriceExpression = typeCheck<SyntheticPriceExpression>()({
  // UMA-based
  CADUMA: {
    simple: 'CADUSD * (1/ETHUSD) * (1/UMAETH)',
    inverted: 'UMAETH * ETHUSD * (1/CADUSD)',
  },
  GBPUMA: {
    simple: 'GBPUSD * (1/ETHUSD) * (1/UMAETH)',
  },
  CHFUMA: {
    simple: 'CHFUSD * (1/ETHUSD) * (1/UMAETH)',
  },
  EURUMA: {
    simple: 'EURUSD * (1/ETHUSD) * (1/UMAETH)',
  },
  ZARUMA: {
    simple: 'ZARUSD * (1/ETHUSD) * (1/UMAETH)',
  },
  PHPUMA: {
    simple: 'PHPUSD * (1/ETHUSD) * (1/UMAETH)',
  },
  NGNUMA: {
    simple: 'NGNUSD * (1/ETHUSD) * (1/UMAETH)',
  },
  KRWUMA: {
    simple: 'KRWUSD * (1/ETHUSD) * (1/UMAETH)',
  },
  JPYUMA: {
    simple: 'JPYUSD * (1/ETHUSD) * (1/UMAETH)',
  },

  // USDC-based
  CADUSD: {
    simple: 'CADUSD * (1/ETHUSD)',
  },
  GBPUSD: {
    simple: 'GBPUSD * (1/ETHUSD)',
  },
  CHFUSD: {
    simple: 'CHFUSD * (1/ETHUSD)',
  },
  EURUSD: {
    simple: 'EURUSD * (1/ETHUSD)',
  },
  ZARUSD: {
    simple: 'ZARUSD * (1/ETHUSD)',
  },
  PHPUSD: {
    simple: 'PHPUSD * (1/ETHUSD)',
  },
  NGNUSD: {
    simple: 'NGNUSD * (1/ETHUSD)',
  },
  KRWUSD: {
    simple: 'KRWUSD * (1/ETHUSD)',
  },
  JPYUSD: {
    simple: 'JPYUSD * (1/ETHUSD)',
  },
});
