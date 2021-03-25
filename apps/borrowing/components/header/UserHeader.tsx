import React, { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import {
  AccountSummary,
  NotificationType,
  useNotifications,
  useWindowSize,
} from '@jarvis-network/ui';

import { setTheme } from '@/state/slices/theme';
import { State } from '@/state/initialState';
import { useReduxSelector } from '@/state/useReduxSelector';
import { useAuth } from '@/utils/useAuth';
import { Address } from '@jarvis-network/web3-utils/eth/address';
import { setAuthModalVisible } from '@/state/slices/app';
import {
  formatWalletAddress,
  usePrettyName,
} from '@jarvis-network/app-toolkit';

const noop = () => undefined;

const UserHeader = () => {
  const dispatch = useDispatch();
  const auth = useReduxSelector(state => state.auth);
  const { logout } = useAuth() || {};
  const name = usePrettyName((auth?.address ?? null) as Address | null);
  const [isSigningOut, setSigningOut] = useState(false);
  const { innerWidth } = useWindowSize();
  const notify = useNotifications();

  const handleLogIn = async () => {
    dispatch(setAuthModalVisible(true));
  };

  const handleLogOut = () => {
    logout!();
    setSigningOut(true);
  };

  const handleSetTheme = (theme: State['theme']) => {
    dispatch(setTheme({ theme }));
  };

  useEffect(() => {
    if (isSigningOut) {
      setTimeout(() => {
        setSigningOut(false);

        notify('You have successfully signed out', {
          type: NotificationType.error,
          icon: '👋🏻',
        });
      }, 1000);
    }
  }, [isSigningOut]);

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

  const image = undefined; // @TODO fix mock

  return (
    <AccountSummary
      name={getName()}
      wallet={getAddress()}
      image={image}
      menu={[]}
      contentOnTop={innerWidth <= 1080}
      onLogout={isSigningOut ? noop : handleLogOut}
      onLogin={isSigningOut ? noop : handleLogIn}
      onThemeChange={handleSetTheme}
      onHelp={onHelp}
    />
  );
};

export { UserHeader };
