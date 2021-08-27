import { SelfMintingMarketAssets } from '@/state/slices/markets';

export const selfMintingMarketAssets: SelfMintingMarketAssets<'mainnet'> = {
  'jCAD/UMA': {
    pair: 'jCAD/UMA',
    assetIn: {
      name: 'UMA',
      icon: 'uma',
    },
    assetOut: {
      icon: 'cad',
      name: 'jCAD',
    },
  },
  'jCAD/USDC': {
    pair: 'jCAD/USDC',
    assetIn: {
      name: 'USDC',
      icon: 'usdc',
    },
    assetOut: {
      name: 'jCAD',
      icon: 'cad',
    },
  },
  'jCHF/UMA': {
    pair: 'jCHF/UMA',
    assetIn: {
      name: 'UMA',
      icon: 'uma',
    },
    assetOut: {
      name: 'jCHF',
      icon: 'chf',
    },
  },
  'jCHF/USDC': {
    pair: 'jCHF/USDC',
    assetIn: {
      name: 'USDC',
      icon: 'usdc',
    },
    assetOut: {
      name: 'jCHF',
      icon: 'chf',
    },
  },
  'jEUR/UMA': {
    pair: 'jEUR/UMA',
    assetIn: {
      name: 'UMA',
      icon: 'uma',
    },
    assetOut: {
      name: 'jEUR',
      icon: 'eur',
    },
  },
  'jEUR/USDC': {
    pair: 'jEUR/USDC',
    assetIn: {
      name: 'USDC',
      icon: 'usdc',
    },
    assetOut: {
      name: 'jEUR',
      icon: 'eur',
    },
  },
  'jGBP/UMA': {
    pair: 'jGBP/UMA',
    assetIn: {
      name: 'UMA',
      icon: 'uma',
    },
    assetOut: {
      name: 'jGBP',
      icon: 'gbp',
    },
  },
  'jGBP/USDC': {
    pair: 'jGBP/USDC',
    assetIn: {
      name: 'USDC',
      icon: 'usdc',
    },
    assetOut: {
      name: 'jGBP',
      icon: 'gbp',
    },
  },
  'jJPY/UMA': {
    pair: 'jJPY/UMA',
    assetIn: {
      name: 'UMA',
      icon: 'uma',
    },
    assetOut: {
      name: 'jJPY',
      icon: 'jpy',
    },
  },
  'jJPY/USDC': {
    pair: 'jJPY/USDC',
    assetIn: {
      name: 'USDC',
      icon: 'usdc',
    },
    assetOut: {
      name: 'jJPY',
      icon: 'jpy',
    },
  },
  'jKRW/UMA': {
    pair: 'jKRW/UMA',
    assetIn: {
      name: 'UMA',
      icon: 'uma',
    },
    assetOut: {
      name: 'jKRW',
      icon: 'krw',
    },
  },
  'jKRW/USDC': {
    pair: 'jKRW/USDC',
    assetIn: {
      name: 'USDC',
      icon: 'usdc',
    },
    assetOut: {
      name: 'jKRW',
      icon: 'krw',
    },
  },
  'jNGN/UMA': {
    pair: 'jNGN/UMA',
    assetIn: {
      name: 'UMA',
      icon: 'uma',
    },
    assetOut: {
      name: 'jNGN',
      icon: 'ngn',
    },
  },
  'jNGN/USDC': {
    pair: 'jNGN/USDC',
    assetIn: {
      name: 'USDC',
      icon: 'usdc',
    },
    assetOut: {
      name: 'jNGN',
      icon: 'ngn',
    },
  },
  'jPHP/UMA': {
    pair: 'jPHP/UMA',
    assetIn: {
      name: 'UMA',
      icon: 'uma',
    },
    assetOut: {
      name: 'jPHP',
      icon: 'php',
    },
  },
  'jPHP/USDC': {
    pair: 'jPHP/USDC',
    assetIn: {
      name: 'USDC',
      icon: 'usdc',
    },
    assetOut: {
      name: 'jPHP',
      icon: 'php',
    },
  },
  'jZAR/UMA': {
    pair: 'jZAR/UMA',
    assetIn: {
      name: 'UMA',
      icon: 'uma',
    },
    assetOut: {
      name: 'jZAR',
      icon: 'zar',
    },
  },
  'jZAR/USDC': {
    pair: 'jZAR/USDC',
    assetIn: {
      name: 'USDC',
      icon: 'usdc',
    },
    assetOut: {
      name: 'jZAR',
      icon: 'zar',
    },
  },
} as const;
