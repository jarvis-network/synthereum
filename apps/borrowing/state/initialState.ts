import { ThemeNameType } from '@jarvis-network/ui';

import { cache } from '@jarvis-network/app-toolkit';
import { Market } from '@/state/slices/markets';
import { UserState } from 'bnc-onboard/dist/src/interfaces';
import { MockMarkets } from '@/data/markets';

export type AuthState =
  | (Omit<UserState, 'wallet'> & { wallet: UserState['wallet']['name'] })
  | null;

export interface State {
  theme: ThemeNameType;
  app: {
    isAuthModalVisible: boolean;
  };
  auth: AuthState;
  markets: {
    filterQuery: string | null;
    manageKey: string | null;
    list: Market[];
  };
}

export const initialState: State = {
  theme: cache.get<ThemeNameType | null>('jarvis/state/theme') || 'light',
  app: {
    isAuthModalVisible: false,
  },
  auth: null,
  markets: {
    filterQuery: null,
    manageKey: null,
    list: MockMarkets,
  },
};
