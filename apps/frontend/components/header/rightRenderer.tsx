import React, { useContext, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { AccountSummary, useWindowSize } from '@jarvis-network/ui';
import { Address } from '@jarvis-network/web3-utils/eth/address';

import { AuthContext } from '@/components/auth/AuthProvider';
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

const render = () => {
  const dispatch = useDispatch();
  const auth = useReduxSelector(state => state.auth);
  const authLogin = useContext(AuthContext);
  const name = usePrettyName((auth?.address ?? null) as Address | null);
  const { innerWidth } = useWindowSize();

  const handleLogIn = async () => {
    dispatch(setAuthModalVisible(true));
  };

  const handleLogOut = () => {
    authLogin!.logout();

    // @TODO Just clear data in Redux without hard-reload
    window.location.reload();
  };

  const handleSetTheme = (theme: State['theme']) => {
    dispatch(setTheme({ theme }));
  };

  const handleAccountOverviewOpen = () => {
    dispatch(setAccountOverviewModalVisible(true));
  };

  const links = [
    {
      name: 'Account',
      key: 'Account',
      onClick: handleAccountOverviewOpen,
    },
    {
      name: 'Help',
      key: 'Help',
      onClick: () =>
        window.open(
          'https://jarvis-exchange.crisp.help/en/',
          '_blank',
          'noopener',
        ),
    },
  ];

  const addr = auth ? formatWalletAddress(auth.address) : undefined;
  const image = auth ? avatar(auth.address) : undefined;

  return (
    <AccountSummary
      name={name || ''}
      wallet={addr}
      image={image}
      menu={links}
      mode="demo"
      contentOnTop={innerWidth <= 1080}
      onLogout={handleLogOut}
      onLogin={handleLogIn}
      onThemeChange={handleSetTheme}
    />
  );
};

const rightRenderer = { render };
export { rightRenderer };
