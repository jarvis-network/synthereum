// Transactions
import { toUpperFirst } from '@jarvis-network/app-toolkit';

import { TransactionStatus, TransactionType } from '@/data/transactions';

export function formatTransactionType(type: TransactionType) {
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
