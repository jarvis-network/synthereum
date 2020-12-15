import { ThemeNameType } from '@jarvis-network/ui';
import { UserState } from 'bnc-onboard/dist/src/interfaces';

import { assets, Asset } from '@/data/assets';
import { transactions, Transaction } from '@/data/transactions';
import { fakeWallet } from '@/data/fakeWallet.ts';
import { FPN } from '@jarvis-network/web3-utils/base/fixed-point-number';

type Values = 'pay' | 'receive';

export interface WalletInfo {
  amount: FPN;
}

export interface Rate {
  rate: FPN;
}

export interface State {
  theme: ThemeNameType;
  app: {
    isAccountOverviewModalVisible: boolean;
    isRecentActivityModalVisible: boolean;
    isAccountDropdownExpanded: boolean;
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
    payAsset: string;
    receiveAsset: string;
    invertRateInfo: boolean;
    chooseAssetActive: Values | null;
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
    isAccountDropdownExpanded: false,
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
  wallet: fakeWallet as { [key: string]: WalletInfo },
  transactions: {
    list: transactions,
  },
};

export type AssetType = Values;
