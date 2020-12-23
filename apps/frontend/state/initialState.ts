import { ThemeNameType } from '@jarvis-network/ui';
import { UserState } from 'bnc-onboard/dist/src/interfaces';

import { FPN } from '@jarvis-network/web3-utils/base/fixed-point-number';
import { SyntheticSymbol } from '@jarvis-network/synthereum-contracts/dist/src/config';
import { PrimaryStableCoin } from '@jarvis-network/synthereum-contracts/dist/src/config/data/stable-coin';

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

export interface PricePoint {
  time: string; // in format YYYY-MM-DD
  open: number;
  high: number;
  low: number;
  close: number;
  history: boolean;
}

export interface PricePointsMap {
  [pair: string]: PricePoint[];
}

export interface State {
  theme: ThemeNameType;
  app: {
    isAccountOverviewModalVisible: boolean;
    isRecentActivityModalVisible: boolean;
    isAccountDropdownExpanded: boolean;
    isFullScreenLoaderVisible: boolean;
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
    payAsset: SyntheticSymbol | PrimaryStableCoin | null;
    receiveAsset: SyntheticSymbol | PrimaryStableCoin | null;
    invertRateInfo: boolean;
    chooseAssetActive: Values | null;
  };
  wallet: {
    [key in SyntheticSymbol | PrimaryStableCoin]?: WalletInfo;
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
    isAccountDropdownExpanded: false,
    isFullScreenLoaderVisible: false,
  },
  auth: null,
  assets: {
    list: assets,
  },
  exchange: {
    pay: '0',
    receive: '0',
    base: 'pay',
    payAsset: 'USDC',
    receiveAsset: 'jEUR',
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
