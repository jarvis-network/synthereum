import { assertIsAddress as A } from '@jarvis-network/web3-utils/eth/address';
import { Fees, PerNetwork } from '../types';

export const fees: PerNetwork<Fees> = {
  '42': {
    feePercentage: 0.001,
    feeRecipients: [
      A('0xCc3528125499d168ADFB5Ef99895c98a7C430ed4'),
      A('0xCc3528125499d168ADFB5Ef99895c98a7C430ed4'),
    ],
    feeProportions: [50, 50],
  },
};
