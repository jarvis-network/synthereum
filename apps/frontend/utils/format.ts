import { TransactionStatus, TransactionType } from '@/data/transactions';

export const toUpperFirst = (str: string) =>
  `${str.charAt(0).toUpperCase()}${str.slice(1)}`;

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

export function formatDate(timestamp: number) {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();

  const formatedMonth = month < 10 ? `0${month}` : month;
  const formatedDay = day < 10 ? `0${day}` : day;

  return `${year}-${formatedMonth}-${formatedDay}`;
}

export const formatExchangeAmount = (value: string) => {
  const [, decimals] = value.split('.');

  if (decimals && decimals.length > 5) {
    return Number(value).toFixed(5);
  }

  return value;
};

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
