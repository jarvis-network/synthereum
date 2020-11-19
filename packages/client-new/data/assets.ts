import { FlagKeys } from '@jarvis-network/ui';

interface AssetType {
  name: string;
  symbol: string;
  icon: FlagKeys | null;
  price: number;
  type: 'forex' | 'crypto';
}

interface AssetPairType {
  input: AssetType;
  output: AssetType;
  name: string; // used for easier filtering
}

export const PRIMARY_STABLE_COIN: Asset = {
  name: 'USDC',
  symbol: 'USDC',
  icon: 'us',
  price: 1,
  type: 'forex',
};

export interface AssetWithWalletInfo extends Asset {
  stableCoinValue: number;
  ownedAmount: number;
}

export const assets: Asset[] = [
  PRIMARY_STABLE_COIN,
  {
    name: 'Jarvis Synthetic Euro',
    symbol: 'jEUR',
    icon: 'eur',
    price: 1.2, // @TODO remove all fake prices
    type: 'forex',
  },
  {
    name: 'Jarvis Synthetic Swiss Franc',
    symbol: 'jCHF',
    icon: 'chf',
    price: 1.4,
    type: 'forex',
  },
  {
    name: 'Jarvis Synthetic British Pound',
    symbol: 'jGBP',
    icon: 'gbp',
    price: 1.5,
    type: 'forex',
  },
  {
    name: 'Jarvis Synthetic Gold',
    symbol: 'jXAU',
    icon: null,
    price: 4.4,
    type: 'forex',
  },
  {
    name: 'Jarvis Synthetic S&P500',
    symbol: 'jSPX',
    icon: null,
    price: 3.13,
    type: 'forex',
  },
  {
    name: 'Jarvis Synthetic Crude Oil',
    symbol: 'jXTI',
    icon: null,
    price: 21.15,
    type: 'forex',
  },
  {
    name: 'Jarvis Synthetic Silver',
    symbol: 'jXAG',
    icon: null,
    price: 0.55,
    type: 'forex',
  },
];

export type Asset = AssetType;
export type AssetPair = AssetPairType;
