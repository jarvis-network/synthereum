import { ThemeNameType } from '@jarvis-network/ui';

import { cache } from '@jarvis-network/app-toolkit';
import { UserState } from 'bnc-onboard/dist/src/interfaces';

export type AuthState =
  | (Omit<UserState, 'wallet'> & { wallet: UserState['wallet']['name'] })
  | null;

export interface State {
  theme: ThemeNameType;
  app: {
    isAuthModalVisible: boolean;
    isUnsupportedNetworkModalVisible: boolean;
  };
  auth: AuthState;
  claim: {
    investorInfo: string; // big number
    endTime: number; // timestamp in seconds
    startTime: number; // timestamp in seconds
    claimableJRT: string; // big number
    claimedAmount: string; // big number
  } | null;
}

export const initialAppState: State = {
  theme: cache.get<ThemeNameType | null>('jarvis/state/theme') || 'light',
  app: {
    isAuthModalVisible: false,
    isUnsupportedNetworkModalVisible: false,
  },
  auth: null,
  claim: null,
};
