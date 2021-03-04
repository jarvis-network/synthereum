import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch } from 'react-redux';
import { AccountSummary, useWindowSize } from '@jarvis-network/ui';
import { Address } from '@jarvis-network/web3-utils/eth/address';

import { setTheme } from '@/state/slices/theme';
import {
  setAccountOverviewModalVisible,
  setAuthModalVisible,
} from '@/state/slices/app';
import { avatar } from '@/utils/avatar';
import { formatWalletAddress } from '@/utils/format';
import { usePrettyName } from '@/utils/usePrettyName';
import { useReduxSelector } from '@/state/useReduxSelector';
import { State } from '@/state/initialState';
import { setLoginState } from '@/state/slices/auth';
import { setTransactionsHistory } from '@/state/slices/transactions';
import { setWalletBalance } from '@/state/slices/wallet';
import { useAuth } from '@/utils/useAuth';

const noop = () => undefined;

const render = () => {
  const dispatch = useDispatch();
  const auth = useReduxSelector(state => state.auth);
  const { logout } = useAuth() || {};
  const name = usePrettyName((auth?.address ?? null) as Address | null);
  const [isSigningOut, setSigningOut] = useState(false);
  const { innerWidth } = useWindowSize();

  const handleLogIn = async () => {
    dispatch(setAuthModalVisible(true));
  };

  const handleLogOut = () => {
    logout!();
    setSigningOut(true);
    dispatch(setWalletBalance({}));
    dispatch(setLoginState(null));
    dispatch(setTransactionsHistory([]));
  };

  const handleSetTheme = (theme: State['theme']) => {
    dispatch(setTheme({ theme }));
  };

  const handleAccountOverviewOpen = () => {
    dispatch(setAccountOverviewModalVisible(true));
  };

  useEffect(() => {
    if (isSigningOut) {
      setTimeout(() => setSigningOut(false), 1000);
    }
  }, [isSigningOut]);

  const links = [
    {
      name: 'Account',
      key: 'Account',
      onClick: handleAccountOverviewOpen,
    },
  ];

  const onHelp = () =>
    window.open('https://help.jarvis.exchange/en/', '_blank', 'noopener');

  const getName = () => {
    if (isSigningOut) {
      return '';
    }

    return name || '';
  };

  const getAddress = () => {
    if (isSigningOut) {
      return 'Signing out...';
    }

    return auth ? formatWalletAddress(auth.address) : undefined;
  };

  const image = useMemo(
    () => (auth && !isSigningOut ? avatar(auth.address) : undefined),
    [auth, isSigningOut],
  );

  return (
    <AccountSummary
      name={getName()}
      wallet={getAddress()}
      image={image}
      menu={links}
      mode="demo"
      contentOnTop={innerWidth <= 1080}
      onLogout={isSigningOut ? noop : handleLogOut}
      onLogin={isSigningOut ? noop : handleLogIn}
      onThemeChange={handleSetTheme}
      onHelp={onHelp}
    />
  );
};

const rightRenderer = { render };
export { rightRenderer };
