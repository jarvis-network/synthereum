import { FlagKeys } from '@jarvis-network/ui';
import BN from 'bn.js';

export interface Asset {
  name: string;
  symbol: string;
  icon: FlagKeys | null;
  price: number;
  decimals: number;
  type: 'forex' | 'crypto';
}

export interface AssetPair {
  input: Asset;
  output: Asset;
  name: string; // used for easier filtering
}

export const PRIMARY_STABLE_COIN: Asset = {
  name: 'USDC',
  symbol: 'USDC',
  icon: 'us',
  price: 1,
  decimals: 2,
  type: 'forex',
};

export interface AssetWithWalletInfo extends Asset {
  stableCoinValue: BN;
  ownedAmount: BN;
}

export const assets: Asset[] = [
  PRIMARY_STABLE_COIN,
  {
    name: 'Jarvis Synthetic Euro',
    symbol: 'jEUR',
    icon: 'eur',
    price: 1.2, // @TODO remove all fake prices
    decimals: 2,
    type: 'forex',
  },
  {
    name: 'Jarvis Synthetic Swiss Franc',
    symbol: 'jCHF',
    icon: 'chf',
    price: 1.4,
    decimals: 1,
    type: 'forex',
  },
  {
    name: 'Jarvis Synthetic British Pound',
    symbol: 'jGBP',
    icon: 'gbp',
    price: 1.5,
    decimals: 2,
    type: 'forex',
  },
  {
    name: 'Jarvis Synthetic Gold',
    symbol: 'jXAU',
    icon: null,
    price: 4.4,
    decimals: 2,
    type: 'forex',
  },
  {
    name: 'Jarvis Synthetic S&P500',
    symbol: 'jSPX',
    icon: null,
    price: 3.13,
    decimals: 2,
    type: 'forex',
  },
  {
    name: 'Jarvis Synthetic Crude Oil',
    symbol: 'jXTI',
    icon: null,
    price: 21.15,
    decimals: 2,
    type: 'forex',
  },
  {
    name: 'Jarvis Synthetic Silver',
    symbol: 'jXAG',
    icon: null,
    price: 0.55,
    decimals: 2,
    type: 'forex',
  },
];
