import { useDispatch } from 'react-redux';
import { setLoginState } from '@/state/slices/auth';
import { useBehaviorSubject } from './useBehaviorSubject';
import { useCoreObservables } from './CoreObservablesContext';
import { useMemo } from 'react';
import type Onboard from 'bnc-onboard';

function authFactory(
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
        dispatch(setLoginState({ ...state, wallet: walletName }));
      }
      return check;
    },
    logout() {
      onboard.walletReset();
      const {
        wallet: { name: wallet },
        ...state
      } = onboard.getState();
      localStorage.removeItem('jarvis/autologin');

      dispatch(setLoginState({ ...state, wallet }));
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
