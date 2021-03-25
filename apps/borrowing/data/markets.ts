import { Market } from '@/state/slices/markets';

export const MockMarkets: Market[] = [
  {
    key: 'JRT-jEUR',
    assetIn: {
      name: 'JRT',
      icon: null,
    },
    assetOut: {
      name: 'jEUR',
      icon: 'eur',
    },
    collateralizationRatio: 10,
    liquidationRatio: 3,
    collateral: 10.3,
    assetOutMinted: 497.35,
  },
  {
    key: 'JRT-jCHF',
    assetIn: {
      name: 'JRT',
      icon: null,
    },
    assetOut: {
      name: 'jCHF',
      icon: 'eur',
    },
    collateralizationRatio: 10,
    liquidationRatio: 30,
    collateral: 11.2,
    assetOutMinted: 395.48,
  },
  {
    key: 'UMA-jEUR',
    assetIn: {
      name: 'UMA',
      icon: null,
    },
    assetOut: {
      name: 'jEUR',
      icon: 'eur',
    },
    collateralizationRatio: 5,
    liquidationRatio: 2,
    collateral: 51.5,
    assetOutMinted: 442.93,
  },
  {
    key: 'JRT-jGBP',
    assetIn: {
      name: 'JRT',
      icon: null,
    },
    assetOut: {
      name: 'jGBP',
      icon: 'gbp',
    },
    collateralizationRatio: 10,
    liquidationRatio: 3,
  },
  {
    key: 'UMA-jGBP',
    assetIn: {
      name: 'UMA',
      icon: null,
    },
    assetOut: {
      name: 'jGBP',
      icon: 'gbp',
    },
    collateralizationRatio: 5,
    liquidationRatio: 2,
  },
  {
    key: 'UMA-jCHF',
    assetIn: {
      name: 'UMA',
      icon: null,
    },
    assetOut: {
      name: 'jCHF',
      icon: 'chf',
    },
    collateralizationRatio: 5,
    liquidationRatio: 2,
  },
];
