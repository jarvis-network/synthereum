import { assertIsAddress as A } from '@jarvis-network/web3-utils/eth/address';
import { Fees, PerNetwork } from '../types';

export const fees = {
  '42': {
    feePercentage: 0.001,
    feeRecipients: [
      A('0xCc3528125499d168ADFB5Ef99895c98a7C430ed4'),
      A('0xCc3528125499d168ADFB5Ef99895c98a7C430ed4'),
    ],
    feeProportions: [50, 50],
  },
} as const; // Mark as const so TS can know what networks are actually defined

// Ensure that the object literal above has compatible type with what we expect.
// Mark it as export to prevent TS from warning that it is not used:
export const __typecheck: PerNetwork<Fees> = fees;
