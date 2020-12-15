import { FlagKeys } from '@jarvis-network/ui';
import { FPN } from '@jarvis-network/web3-utils/base/fixed-point-number';

export interface Asset {
  name: string;
  symbol: string;
  icon: FlagKeys | null;
  price: FPN;
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
  price: new FPN(1),
  decimals: 6,
  type: 'forex',
};

export interface AssetWithWalletInfo extends Asset {
  stableCoinValue: FPN;
  ownedAmount: FPN;
}

export const PRICE_DECIMALS = 5;

export const assets: Asset[] = [
  PRIMARY_STABLE_COIN,
  {
    name: 'Jarvis Synthetic Euro',
    symbol: 'jEUR',
    icon: 'eur',
    price: new FPN(1.21), // @TODO remove all fake prices
    decimals: 18,
    type: 'forex',
  },
  {
    name: 'Jarvis Synthetic Swiss Franc',
    symbol: 'jCHF',
    icon: 'chf',
    price: new FPN(1.4),
    decimals: 18,
    type: 'forex',
  },
  {
    name: 'Jarvis Synthetic British Pound',
    symbol: 'jGBP',
    icon: 'gbp',
    price: new FPN(1.5),
    decimals: 18,
    type: 'forex',
  },
  {
    name: 'Jarvis Synthetic Gold',
    symbol: 'jXAU',
    icon: null,
    price: new FPN(4.4),
    decimals: 18,
    type: 'forex',
  },
  {
    name: 'Jarvis Synthetic S&P500',
    symbol: 'jSPX',
    icon: null,
    price: new FPN(3.13),
    decimals: 18,
    type: 'forex',
  },
  {
    name: 'Jarvis Synthetic Crude Oil',
    symbol: 'jXTI',
    icon: null,
    price: new FPN(21.15),
    decimals: 18,
    type: 'forex',
  },
  {
    name: 'Jarvis Synthetic Silver',
    symbol: 'jXAG',
    icon: null,
    price: new FPN(0.55),
    decimals: 18,
    type: 'forex',
  },
];
