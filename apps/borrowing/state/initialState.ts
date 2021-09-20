import { ThemeNameType } from '@jarvis-network/ui';
import { cache } from '@jarvis-network/app-toolkit';
import { SelfMintingMarketAssets } from '@/state/slices/markets';
import { UserState } from 'bnc-onboard/dist/src/interfaces';
import {
  ExchangeSelfMintingToken,
  SupportedSelfMintingPairExact,
} from '@jarvis-network/synthereum-config';
import { StringAmount } from '@jarvis-network/core-utils/dist/base/big-number';
import { PriceFeedSymbols } from '@jarvis-network/synthereum-ts/dist/epics/price-feed';

export type AuthState =
  | (Omit<UserState, 'wallet'> & { wallet: UserState['wallet']['name'] })
  | null;

export interface WalletInfo {
  amount: StringAmount;
}
export type OPType = 'borrow';
export interface State {
  theme: ThemeNameType;
  app: {
    isAuthModalVisible: boolean;
    isUnsupportedNetworkModalVisible: boolean;
    poolingFrequency: number;
    isWindowLoaded: boolean;
    networkId: number;
    agentAddress: string | null;
  };
  auth: AuthState;
  markets: {
    filterQuery: string | null;
    manageKey: SupportedSelfMintingPairExact | null;
    list: Partial<SelfMintingMarketAssets>;
  };
  wallet: {
    [key in ExchangeSelfMintingToken]?: WalletInfo;
  };
  prices: {
    [key in PriceFeedSymbols]?: StringAmount;
  };
  transaction: {
    params?: any;
    txHash?: string;
    opType?: OPType | 'cancel' | 'initial';
    receipt?: any;
    valid?: boolean;
    error?: {
      message: string;
    };
  };
}

export const initialAppState: State = {
  theme: cache.get<ThemeNameType | null>('jarvis/state/theme') || 'light',
  app: {
    isAuthModalVisible: false,
    isUnsupportedNetworkModalVisible: false,
    isWindowLoaded: false,
    poolingFrequency: 5000,
    networkId: 0,
    agentAddress: null,
  },
  auth: null,
  markets: {
    filterQuery: null,
    manageKey: null,
    list: {},
  },
  wallet: {},
  prices: {},
  transaction: {
    valid: false,
    // params: {
    //   pair: 'jCHF/USDC',
    //   collateral: '100000000000000000000',
    //   numTokens: '80000000000000000000',
    //   feePercentage: '1650000000000000',
    // },
    // opType: 'borrow',
    // txHash: '0x1c8cf561e54cf2740cc0026f8f8f5d0a7cef787d7b279260e050cc4832d434d2',
    // receipt: {
    //   txHash: '0x1c8cf561e54cf2740cc0026f8f8f5d0a7cef787d7b279260e050cc4832d434d2',
    // }
  },
};
