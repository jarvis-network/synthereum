// Transactions
import { toUpperFirst } from '@jarvis-network/app-toolkit';

import { SynthereumTransactionType } from '@/data/transactions';
import {
  RegularTransaction,
  TransactionStatus,
} from '@jarvis-network/core-utils/dist/eth/transaction';

// Transactions
export function formatTransactionType(
  type: SynthereumTransactionType | RegularTransaction['type'],
) {
  if (type === 'sendToSelf') {
    return 'Send to Self';
  }

  return toUpperFirst(type);
}

export const formatTransactionStatus = (status: TransactionStatus) => {
  if (status === 'failure') {
    return 'Failed';
  }

  if (status === 'success') {
    return 'Approved';
  }

  return 'Pending';
};
