import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch } from 'react-redux';
import {
  AccountSummary,
  noop,
  NotificationType,
  useNotifications,
  useWindowSize,
} from '@jarvis-network/ui';

import { setTheme } from '@/state/slices/theme';
import { State } from '@/state/initialState';
import { avatar } from '@/utils/avatar';

import { Address } from '@jarvis-network/core-utils/dist/eth/address';
import { setAuthModalVisible } from '@/state/slices/app';
import {
  formatWalletAddress,
  useAuth,
  usePrettyName,
  useWeb3,
} from '@jarvis-network/app-toolkit';
import { networkIdToName } from '@jarvis-network/core-utils/dist/eth/networks';

const UserHeader = (): JSX.Element => {
  const dispatch = useDispatch();
  const { account: address, chainId: networkId } = useWeb3();

  const { logout } = useAuth();
  const name = usePrettyName((address ?? null) as Address | null);

  const [isSigningOut, setSigningOut] = useState(false);
  const { innerWidth } = useWindowSize();
  const notify = useNotifications();

  const handleLogIn = () => {
    dispatch(setAuthModalVisible(true));
  };

  const handleLogOut = () => {
    logout();
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
  }, [isSigningOut, notify]);

  const onHelp = () =>
    window.open('https://help.jarvis.exchange/en/', '_blank', 'noopener');

  const getAddress = () => {
    if (isSigningOut) {
      return 'Signing out...';
    }

    return address ? formatWalletAddress(address) : undefined;
  };

  const image = useMemo(
    () => (address && !isSigningOut ? avatar(address) : undefined),
    [address, isSigningOut],
  );

  const networkProp = networkId ? networkIdToName[networkId as 1] : undefined;

  return (
    <AccountSummary
      name={isSigningOut ? '' : name || ''}
      wallet={getAddress()}
      image={image}
      menu={[]}
      network={networkProp === 'mainnet' ? 'ethereum' : networkProp}
      contentOnTop={innerWidth <= 1080}
      onLogout={isSigningOut ? noop : handleLogOut}
      onLogin={isSigningOut ? noop : handleLogIn}
      onThemeChange={handleSetTheme}
      onHelp={onHelp}
    />
  );
};

export { UserHeader };
