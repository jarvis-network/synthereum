import { PRIMARY_STABLE_COIN } from '@/data/assets';

export const formatTokenAmount = (value: number) => value.toFixed(0);

export const formatTokenPrice = (value: number) =>
  `${value.toFixed(0)} ${PRIMARY_STABLE_COIN.name}`;

export const formatFIATPrice = (value: number) => `$ ${value.toFixed(2)}`;

export const formatRate = (value: number) => value.toFixed(5);
