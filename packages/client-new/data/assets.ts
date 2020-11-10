interface AssetType {
  name: string;
  symbol: string;
  priceFeed: string;
  uiFeed: string;
  icon: 'eur' | 'chf' | 'gbp';
  price: number;
  collateral: number;
  totalTokens: number;
  type: 'forex' | 'asset';
}

interface AssetPairType {
  input: AssetType;
  output: AssetType;
  name: string; // used for easier filtering
}

export const assets: Asset[] = [
  {
    name: 'Jarvis Synthetic Euro',
    symbol: 'jEUR',
    priceFeed: 'EURUSD',
    uiFeed: 'EURUSD',
    icon: 'eur',
    price: 0,
    collateral: 0,
    totalTokens: 0,
    type: 'forex',
  },
  {
    name: 'Jarvis Synthetic Swiss Franc',
    symbol: 'jCHF',
    priceFeed: 'USDCHF',
    uiFeed: 'CHFUSD',
    icon: 'chf',
    price: 0,
    collateral: 0,
    totalTokens: 0,
    type: 'forex',
  },
  {
    name: 'Jarvis Synthetic British Pound',
    symbol: 'jGBP',
    priceFeed: 'GBPUSD',
    uiFeed: 'GBPUSD',
    icon: 'gbp',
    price: 0,
    collateral: 0,
    totalTokens: 0,
    type: 'forex',
  },
  {
    name: 'Jarvis Synthetic Gold',
    symbol: 'jXAU',
    priceFeed: 'XAUUSD',
    uiFeed: 'XAUUSD',
    icon: null,
    price: 0,
    collateral: 0,
    totalTokens: 0,
    type: 'asset',
  },
  {
    name: 'Jarvis Synthetic S&P500',
    symbol: 'jSPX',
    priceFeed: 'SPXUSD',
    uiFeed: 'SPXUSD',
    icon: null,
    price: 0,
    collateral: 0,
    totalTokens: 0,
    type: 'asset',
  },
  {
    name: 'Jarvis Synthetic Crude Oil',
    symbol: 'jXTI',
    priceFeed: 'XTIUSD',
    uiFeed: 'XTIUSD',
    icon: null,
    price: 0,
    collateral: 0,
    totalTokens: 0,
    type: 'asset',
  },
  {
    name: 'Jarvis Synthetic Silver',
    symbol: 'jXAG',
    priceFeed: 'XAGUSD',
    uiFeed: 'XAGUSD',
    icon: null,
    price: 0,
    collateral: 0,
    totalTokens: 0,
    type: 'asset',
  },
];

export type Asset = AssetType;
export type AssetPair = AssetPairType;
