import { useDispatch } from 'react-redux';
import Onboard from 'bnc-onboard';
import {
  authAppFactory,
  useBehaviorSubject,
  useCoreObservables,
} from '@jarvis-network/app-toolkit';
import { useMemo } from 'react';
import { login } from '@/state/slices/auth';
import { logoutAction } from '@/state/actions';

const createOnLogin = (dispatch: ReturnType<typeof useDispatch>) => (
  loginParams: Parameters<typeof login>[0],
) => dispatch(login(loginParams));

const createOnLogout = (dispatch: ReturnType<typeof useDispatch>) => () =>
  dispatch(logoutAction());

export function authFactory(
  onboard: ReturnType<typeof Onboard>,
  dispatch: ReturnType<typeof useDispatch>,
) {
  const onLogin = createOnLogin(dispatch);
  const onLogout = createOnLogout(dispatch);

  return authAppFactory(onboard, onLogin, onLogout);
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
