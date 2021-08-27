import { ThemeNameType } from '@jarvis-network/ui';
import { cache } from '@jarvis-network/app-toolkit';
import { SelfMintingMarketAssets } from '@/state/slices/markets';
import { UserState } from 'bnc-onboard/dist/src/interfaces';
import { SupportedSelfMintingPairExact } from '@jarvis-network/synthereum-config';

export type AuthState =
  | (Omit<UserState, 'wallet'> & { wallet: UserState['wallet']['name'] })
  | null;


export interface State {
  theme: ThemeNameType;
  app: {
    isAuthModalVisible: boolean;
    isUnsupportedNetworkModalVisible: boolean;
    poolingFrequency: number;
    isWindowLoaded: boolean;
    networkId: number;
  };
  auth: AuthState;
  markets: {
    filterQuery: string | null;
    manageKey: SupportedSelfMintingPairExact | null;
    list: Partial<SelfMintingMarketAssets>;
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
  },
  auth: null,
  markets: {
    filterQuery: null,
    manageKey: null,
    list: {},
  },

};
