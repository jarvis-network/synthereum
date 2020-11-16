import { ThemeNameType } from '@jarvis-network/ui';
import { UserState } from 'bnc-onboard/dist/src/interfaces';

import { assets, Asset } from '@/data/assets';
import { transactions, Transaction } from '@/data/transactions';
import fakeWallet from '@/data/fakeWallet.json';

type Values = 'pay' | 'receive';

export interface WalletInfo {
  amount: number;
}

export interface Rate {
  rate: number;
}

export interface State {
  theme: ThemeNameType;
  app: {
    isAccountOverviewModalVisible: boolean;
    isRecentActivityModalVisible: boolean;
  };
  auth: Omit<UserState, 'wallet'>;
  assets: {
    list: Asset[];
  };
  exchange: {
    // pay/receive are stored as string to allow incomplete input fills while
    // typing ie. "1." (mind the dot) - forcing a number instantly will cause
    // dot to be removed as typed
    // these values should be casted to number when needed
    pay: string;
    receive: string;
    base: Values;
    payAsset: string;
    receiveAsset: string;
    invertRateInfo: boolean;
    chooseAssetActive: Values;
  };
  wallet: {
    [key: string]: WalletInfo;
  };
  transactions: {
    list: Transaction[];
  };
}

export const initialState: State = {
  theme: 'light',
  app: {
    isAccountOverviewModalVisible: false,
    isRecentActivityModalVisible: false,
  },
  auth: {
    address: null,
    network: null,
    balance: null,
    mobileDevice: null,
    appNetworkId: null,
  },
  assets: {
    list: assets,
  },
  exchange: {
    pay: '0',
    receive: '0',
    base: 'pay',
    payAsset: null, // @TODO set as USDC
    receiveAsset: null,
    invertRateInfo: false,
    chooseAssetActive: null,
  },
  wallet: fakeWallet as { [key: string]: WalletInfo },
  transactions: {
    list: transactions,
  },
};

export type AssetType = Values;
