import { SelfMintingMarketAssets } from '@/state/slices/markets';

export const selfMintingMarketAssets: SelfMintingMarketAssets<'mainnet'> = {
  'jCAD/UMA': {
    pair: 'jCAD/UMA',
    assetIn: {
      name: 'UMA',
    },
    assetOut: {
      name: 'jCAD',
    },
  },
  'jCAD/USDC': {
    pair: 'jCAD/USDC',
    assetIn: {
      name: 'USDC',
    },
    assetOut: {
      name: 'jCAD',
    },
  },
  'jCHF/UMA': {
    pair: 'jCHF/UMA',
    assetIn: {
      name: 'UMA',
    },
    assetOut: {
      name: 'jCHF',
    },
  },
  'jCHF/USDC': {
    pair: 'jCHF/USDC',
    assetIn: {
      name: 'USDC',
    },
    assetOut: {
      name: 'jCHF',
    },
  },
  'jEUR/UMA': {
    pair: 'jEUR/UMA',
    assetIn: {
      name: 'UMA',
    },
    assetOut: {
      name: 'jEUR',
    },
  },
  'jEUR/USDC': {
    pair: 'jEUR/USDC',
    assetIn: {
      name: 'USDC',
    },
    assetOut: {
      name: 'jEUR',
    },
  },
  'jGBP/UMA': {
    pair: 'jGBP/UMA',
    assetIn: {
      name: 'UMA',
    },
    assetOut: {
      name: 'jGBP',
    },
  },
  'jGBP/USDC': {
    pair: 'jGBP/USDC',
    assetIn: {
      name: 'USDC',
    },
    assetOut: {
      name: 'jGBP',
    },
  },
  'jJPY/UMA': {
    pair: 'jJPY/UMA',
    assetIn: {
      name: 'UMA',
    },
    assetOut: {
      name: 'jJPY',
    },
  },
  'jJPY/USDC': {
    pair: 'jJPY/USDC',
    assetIn: {
      name: 'USDC',
    },
    assetOut: {
      name: 'jJPY',
    },
  },
  'jKRW/UMA': {
    pair: 'jKRW/UMA',
    assetIn: {
      name: 'UMA',
    },
    assetOut: {
      name: 'jKRW',
    },
  },
  'jKRW/USDC': {
    pair: 'jKRW/USDC',
    assetIn: {
      name: 'USDC',
    },
    assetOut: {
      name: 'jKRW',
    },
  },
  'jNGN/UMA': {
    pair: 'jNGN/UMA',
    assetIn: {
      name: 'UMA',
    },
    assetOut: {
      name: 'jNGN',
    },
  },
  'jNGN/USDC': {
    pair: 'jNGN/USDC',
    assetIn: {
      name: 'USDC',
    },
    assetOut: {
      name: 'jNGN',
    },
  },
  'jPHP/UMA': {
    pair: 'jPHP/UMA',
    assetIn: {
      name: 'UMA',
    },
    assetOut: {
      name: 'jPHP',
    },
  },
  'jPHP/USDC': {
    pair: 'jPHP/USDC',
    assetIn: {
      name: 'USDC',
    },
    assetOut: {
      name: 'jPHP',
    },
  },
  'jZAR/UMA': {
    pair: 'jZAR/UMA',
    assetIn: {
      name: 'UMA',
    },
    assetOut: {
      name: 'jZAR',
    },
  },
  'jZAR/USDC': {
    pair: 'jZAR/USDC',
    assetIn: {
      name: 'USDC',
    },
    assetOut: {
      name: 'jZAR',
    },
  },
} as const;
