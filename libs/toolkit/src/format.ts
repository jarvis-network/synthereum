import { FPN } from '@jarvis-network/web3-utils/base/fixed-point-number';

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

export const formatExchangeAmount = (value: string) => new FPN(value).format(5);

// Wallet
export const formatWalletAddress = (address: string) => {
  const start = address.substr(0, 6);
  const end = address.substr(address.length - 4);
  return `${start}...${end}`;
};
