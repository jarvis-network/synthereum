import { ThemeNameType } from '@jarvis-network/ui';

import { ExchangeSynthereumToken } from '@jarvis-network/synthereum-ts/dist/config';
import { FPN } from '@jarvis-network/core-utils/dist/base/fixed-point-number';
import { cache } from '@jarvis-network/app-toolkit';
import { primaryCollateralSymbol } from '@jarvis-network/synthereum-config';

import { Transaction } from '@/data/transactions';
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

export enum TransactionSpeed {
  standard = 'standard',
  fast = 'fast',
  rapid = 'rapid',
}

export const DEFAULT_PAY_ASSET: ExchangeSynthereumToken = primaryCollateralSymbol;
export const DEFAULT_RECEIVE_ASSET: ExchangeSynthereumToken = 'jEUR';
export const DEFAULT_TRANSACTION_SPEED = TransactionSpeed.fast;

export type Days = 1 | 7 | 30;

export interface State {
  theme: ThemeNameType;
  app: {
    isAccountOverviewModalVisible: boolean;
    isRecentActivityModalVisible: boolean;
    isFullScreenLoaderVisible: boolean;
    isSwapLoaderVisible: boolean;
    isAuthModalVisible: boolean;
    isExchangeConfirmationVisible: boolean;
    isWindowLoaded: boolean;
    areExchangeSettingsVisible: boolean;
    mobileTab: number;
  };
  exchange: {
    // pay/receive are stored as string to allow incomplete input fills while
    // typing ie. "1." (mind the dot) - forcing a number instantly will cause
    // dot to be removed as typed
    // these values should be casted/converted when needed
    pay: string;
    receive: string;
    base: Values;
    payAsset: ExchangeSynthereumToken | null;
    receiveAsset: ExchangeSynthereumToken | null;
    invertRateInfo: boolean;
    chooseAssetActive: Values | null;
    chartDays: Days;
    transactionSpeed: TransactionSpeed;
  };
  wallet: {
    [key in ExchangeSynthereumToken]?: WalletInfo;
  };
  transactions: {
    list: Transaction[];
  };
  prices: {
    persistedPairs: SubscriptionPair[];
    feed: PricePointsMap;
  };
}

export const initialAppState: State = {
  theme: cache.get<ThemeNameType | null>('jarvis/state/theme') || 'light',
  app: {
    isAccountOverviewModalVisible: Boolean(
      cache.get<boolean | null>(
        'jarvis/state/app.isAccountOverviewModalVisible',
      ),
    ),
    isRecentActivityModalVisible: Boolean(
      cache.get<boolean | null>(
        'jarvis/state/app.isRecentActivityModalVisible',
      ),
    ),
    isFullScreenLoaderVisible: false,
    isSwapLoaderVisible: false,
    isAuthModalVisible: false,
    isExchangeConfirmationVisible: false,
    isWindowLoaded: false,
    areExchangeSettingsVisible: false,
    mobileTab: 1,
  },
  exchange: {
    pay: '0',
    receive: '0',
    base: 'pay',
    payAsset:
      cache.get<ExchangeSynthereumToken | null>(
        'jarvis/state/exchange.payAsset',
      ) || DEFAULT_PAY_ASSET,
    receiveAsset:
      cache.get<ExchangeSynthereumToken | null>(
        'jarvis/state/exchange.receiveAsset',
      ) || DEFAULT_RECEIVE_ASSET,
    invertRateInfo: false,
    chooseAssetActive: null,
    chartDays: cache.get<Days | null>('jarvis/state/exchange.chartDays') || 7,
    transactionSpeed:
      cache.get<TransactionSpeed>('jarvis/state/exchange.transactionSpeed') ||
      DEFAULT_TRANSACTION_SPEED,
  },
  wallet: {},
  transactions: {
    list: [],
  },
  prices: {
    persistedPairs: [],
    feed: {},
  },
};

export type AssetType = Values;
