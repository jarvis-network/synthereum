import { PRIMARY_STABLE_COIN } from '@/data/assets';
import {
  TransactionIO,
  TransactionStatus,
  TransactionType,
} from '@/data/transactions';
import BN from 'bn.js';

export const toUpperFirst = (str: string) =>
  `${str.charAt(0).toUpperCase()}${str.slice(1)}`;

export const formatTokenPriceBN = (value: BN) =>
  `${value.toString(10)} ${PRIMARY_STABLE_COIN.name}`;

export const formatRate = (value: number) => value.toFixed(5);

export function formatBN(amount: BN, decimals: number) {
  const rawStr = amount.toString(10);
  const integerPart = rawStr.slice(0, -decimals).padStart(1, '0');
  const decimalPart = rawStr.slice(-decimals).padStart(decimals, '0');

  return `${integerPart}.${decimalPart}`;
}

// Dates
const MonthsLabelMap = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

export function formatDayLabel(timestamp: number) {
  const date = new Date(timestamp);
  return `${MonthsLabelMap[date.getMonth()]} ${date.getDate()}`;
}

export function formatTimestamp(timestamp: number) {
  const date = new Date(timestamp);
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour12: true,
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Transactions
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

// Wallet
export const formatWalletAddress = (address: string) => {
  const start = address.substr(0, 6);
  const end = address.substr(address.length - 4);
  return `${start}...${end}`;
};
