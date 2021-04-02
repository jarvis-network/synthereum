import { useMemo } from 'react';
import type Onboard from 'bnc-onboard';

import { useCoreObservables } from './CoreObservablesContext';
import { useBehaviorSubject } from './useBehaviorSubject';

type OnLogin = (s: any) => void;
type OnLogout = () => void;

export function authAppFactory(
  onboard: ReturnType<typeof Onboard>,
  onLogin: OnLogin,
  onLogout: OnLogout,
) {
  return {
    async login(wallet: string | undefined) {
      const select = await onboard.walletSelect(wallet);
      if (!select) {
        return false;
      }
      const check = await onboard.walletCheck();
      const onboardState = onboard.getState();
      const walletName = onboardState.wallet.name;
      if (check && walletName) {
        localStorage.setItem('jarvis/autologin', walletName);
        const { wallet: _, ...state } = onboardState;
        onLogin({ ...state, wallet: walletName });
      }
      return Boolean(check && walletName);
    },
    logout() {
      onboard.walletReset();
      localStorage.removeItem('jarvis/autologin');
      onLogout();
    },
  };
}

export function useAppAuth(
  onLogin: OnLogin,
  onLogout: OnLogout,
): {
  login: (wallet?: string) => Promise<boolean>;
  logout: () => void;
} | null {
  const onboard = useBehaviorSubject(useCoreObservables().onboard$);

  return useMemo(
    () => (onboard ? authAppFactory(onboard, onLogin, onLogout) : null),
    [onboard, onLogin, onLogout],
  );
}
