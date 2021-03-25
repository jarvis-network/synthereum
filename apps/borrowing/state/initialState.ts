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
  };
  auth: AuthState;
}

export const initialState: State = {
  theme: cache.get<ThemeNameType | null>('jarvis/state/theme') || 'light',
  app: {
    isAuthModalVisible: false,
  },
  auth: null,
};
