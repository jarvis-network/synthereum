import React, { createContext, ReactNode, useContext, useMemo } from 'react';
import { Dispatch, AnyAction } from 'redux';
import { useDispatch } from 'react-redux';
import type Onboard from 'bnc-onboard';
import { UserState } from 'bnc-onboard/dist/src/interfaces';
import { Address } from '@jarvis-network/core-utils/dist/eth/address';

import { useCoreObservables } from './CoreObservablesContext';
import { useBehaviorSubject } from './useBehaviorSubject';

export type LoginAction = (
  account: Omit<UserState, 'wallet'> & {
    wallet: UserState['wallet']['name'];
    address: Address;
  },
) => AnyAction;

export type LogoutAction = () => AnyAction;

interface Auth {
  login(wallet?: string): Promise<boolean>;
  logout(): void;
}

export function authFactory(
  onboard: ReturnType<typeof Onboard>,
  dispatch: Dispatch,
  loginAction: LoginAction,
  logoutAction: LogoutAction,
): Auth {
  return {
    async login(wallet?: string) {
      const select = await onboard.walletSelect(wallet);
      if (!select) {
        return false;
      }
      const check = await onboard.walletCheck();
      const onboardState = onboard.getState();
      const walletName = onboardState.wallet.name;
      if (check && walletName) {
        localStorage.setItem('jarvis/autologin', walletName);
        const { wallet: _, address, ...state } = onboardState;
        dispatch(
          loginAction({
            ...state,
            wallet: walletName,
            address: address as Address,
          }),
        );
      }
      return Boolean(check && walletName);
    },
    logout() {
      onboard.walletReset();
      localStorage.removeItem('jarvis/autologin');
      dispatch(logoutAction());
    },
  };
}

const failAuth: Auth = {
  login() {
    return Promise.reject(new Error('Onboard not loaded yet'));
  },
  logout() {
    throw new Error('Onboard not loaded yet');
  },
};

interface AuthContext {
  auth: Auth;
  loginAction: LoginAction;
  logoutAction: LogoutAction;
}

const AuthContext = createContext<AuthContext | null>(null);

export function AuthProvider({
  children,
  loginAction,
  logoutAction,
}: {
  loginAction: LoginAction;
  logoutAction: LogoutAction;
  children: ReactNode;
}): JSX.Element {
  const dispatch = useDispatch();
  const onboard = useBehaviorSubject(useCoreObservables().onboard$);

  const value = useMemo(
    () =>
      onboard
        ? {
            auth: authFactory(onboard, dispatch, loginAction, logoutAction),
            loginAction,
            logoutAction,
          }
        : { auth: failAuth, loginAction, logoutAction },
    [onboard, dispatch, loginAction, logoutAction],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext(): AuthContext {
  const context = useContext(AuthContext);
  if (!context)
    throw new Error(
      'AuthContext not provided. Use `AuthProvider` from `@jarvis-network/app-toolkit`.',
    );
  return context;
}

export function useAuth(): Auth {
  return useAuthContext().auth;
}
