import { useDispatch } from 'react-redux';
import { logoutAction } from '@/state/actions';
import { login } from '@/state/slices/auth';

import { useMemo } from 'react';
import type Onboard from 'bnc-onboard';

import { useCoreObservables } from './CoreObservablesContext';
import { useBehaviorSubject } from './useBehaviorSubject';

export function authFactory(
  onboard: ReturnType<typeof Onboard>,
  dispatch: ReturnType<typeof useDispatch>,
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
        dispatch(login({ ...state, wallet: walletName }));
      }
      return check;
    },
    logout() {
      onboard.walletReset();
      localStorage.removeItem('jarvis/autologin');

      dispatch(logoutAction());
    },
  };
}

export function useAuth(): {
  login: (wallet?: string) => Promise<boolean>;
  logout: () => void;
} | null {
  const dispatch = useDispatch();
  const onboard = useBehaviorSubject(useCoreObservables().onboard$);

  return useMemo(() => (onboard ? authFactory(onboard, dispatch) : null), [
    onboard,
    dispatch,
  ]);
}
