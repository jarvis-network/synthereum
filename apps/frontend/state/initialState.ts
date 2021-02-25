import { ThemeNameType } from '@jarvis-network/ui';
import { UserState } from 'bnc-onboard/dist/src/interfaces';

import { FPN } from '@jarvis-network/web3-utils/base/fixed-point-number';
import { ExchangeToken } from '@jarvis-network/synthereum-contracts/dist/src/config';

import { assets, Asset } from '@/data/assets';
import { transactions, Transaction } from '@/data/transactions';
import { SubscriptionPair } from '@/utils/priceFeed';
import { cache } from '@/utils/cache';

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

export type Days = 1 | 7 | 30;

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
    chartDays: Days;
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
  theme: cache?.get<ThemeNameType | null>('jarvis/state/theme') || 'light',
  app: {
    isAccountOverviewModalVisible: Boolean(
      cache?.get<boolean | null>(
        'jarvis/state/app.isAccountOverviewModalVisible',
      ),
    ),
    isRecentActivityModalVisible: Boolean(
      cache?.get<boolean | null>(
        'jarvis/state/app.isRecentActivityModalVisible',
      ),
    ),
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
    payAsset:
      cache?.get<ExchangeToken | null>('jarvis/state/exchange.payAsset') ||
      DEFAULT_PAY_ASSET,
    receiveAsset:
      cache?.get<ExchangeToken | null>('jarvis/state/exchange.receiveAsset') ||
      DEFAULT_RECEIVE_ASSET,
    invertRateInfo: false,
    chooseAssetActive: null,
    chartDays: cache?.get<Days | null>('jarvis/state/exchange.chartDays') || 7,
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
