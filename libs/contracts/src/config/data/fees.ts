import { typeCheck } from '@jarvis-network/web3-utils/base/meta';
import { assertIsAddress as A } from '@jarvis-network/web3-utils/eth/address';
import { Fees, PerNetwork } from '..';

export const fees = typeCheck<PerNetwork<Fees>>()({
  '42': {
    feePercentage: 0.002,
    feeRecipients: [
      A('0xCc3528125499d168ADFB5Ef99895c98a7C430ed4'),
      A('0xCc3528125499d168ADFB5Ef99895c98a7C430ed4'),
    ],
    feeProportions: [50, 50],
  },
  '1': {
    feePercentage: 0.002,
    feeRecipients: [
      A('0x8eF00583bAa186094D9A34a0A4750C1D1BB86831'),
      A('0xc31249BA48763dF46388BA5C4E7565d62ed4801C'),
    ],
    feeProportions: [50, 50],
  },
} as const); // Mark as const so TS can know what networks are actually defined
