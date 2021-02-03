import { ThemeNameType } from '@jarvis-network/ui';
import { UserState } from 'bnc-onboard/dist/src/interfaces';

import { FPN } from '@jarvis-network/web3-utils/base/fixed-point-number';
import { ExchangeToken } from '@jarvis-network/synthereum-contracts/dist/src/config';

import { assets, Asset } from '@/data/assets';
import { transactions, Transaction } from '@/data/transactions';
import { SubscriptionPair } from '@/utils/priceFeed';

type Values = 'pay' | 'receive';

export interface WalletInfo {
  amount: FPN;
}

export interface Rate {
  rate: FPN;
}

export interface WhitespacePricePoint {
  time: string;
  history?: boolean;
}

export interface PricePoint {
  time: string; // in format YYYY-MM-DD
  open: number;
  high: number;
  low: number;
  close: number;
  history: boolean;
}

export type DataItem = PricePoint | WhitespacePricePoint;

export interface PricePointsMap {
  [pair: string]: PricePoint[];
}

export const DEFAULT_PAY_ASSET: ExchangeToken = 'USDC';
export const DEFAULT_RECEIVE_ASSET: ExchangeToken = 'jEUR';

export interface State {
  theme: ThemeNameType;
  app: {
    isAccountOverviewModalVisible: boolean;
    isRecentActivityModalVisible: boolean;
    isFullScreenLoaderVisible: boolean;
    isAuthModalVisible: boolean;
    mobileTab: number;
  };
  auth: Omit<UserState, 'wallet'> | null;
  assets: {
    list: Asset[];
  };
  exchange: {
    // pay/receive are stored as string to allow incomplete input fills while
    // typing ie. "1." (mind the dot) - forcing a number instantly will cause
    // dot to be removed as typed
    // these values should be casted/converted when needed
    pay: string;
    receive: string;
    base: Values;
    payAsset: ExchangeToken | null;
    receiveAsset: ExchangeToken | null;
    invertRateInfo: boolean;
    chooseAssetActive: Values | null;
  };
  wallet: {
    [key in ExchangeToken]?: WalletInfo;
  };
  transactions: {
    list: Transaction[];
  };
  prices: {
    persistedPairs: SubscriptionPair[];
    feed: PricePointsMap;
  };
}

export const initialState: State = {
  theme: 'light',
  app: {
    isAccountOverviewModalVisible: false,
    isRecentActivityModalVisible: false,
    isFullScreenLoaderVisible: false,
    isAuthModalVisible: false,
    mobileTab: 1,
  },
  auth: null,
  assets: {
    list: assets,
  },
  exchange: {
    pay: '0',
    receive: '0',
    base: 'pay',
    payAsset: DEFAULT_PAY_ASSET,
    receiveAsset: DEFAULT_RECEIVE_ASSET,
    invertRateInfo: false,
    chooseAssetActive: null,
  },
  wallet: {},
  transactions: {
    list: transactions,
  },
  prices: {
    persistedPairs: [],
    feed: {},
  },
};

export type AssetType = Values;
