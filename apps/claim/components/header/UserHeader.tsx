import React from 'react';
import { useDispatch } from 'react-redux';
import { AccountSummary, useWindowSize } from '@jarvis-network/ui';

import { setTheme } from '@/state/slices/theme';
import { State } from '@/state/initialState';
import { Address } from '@jarvis-network/core-utils/dist/eth/address';
import {
  formatWalletAddress,
  useAuth,
  usePrettyName,
  useWeb3,
} from '@jarvis-network/app-toolkit';
import { setAuthModalVisible } from '@/state/slices/app';

const UserHeader = (): JSX.Element => {
  const dispatch = useDispatch();
  const { account: address } = useWeb3();
  const { logout } = useAuth();
  const name = usePrettyName((address ?? null) as Address | null);
  const { innerWidth } = useWindowSize();

  const handleSetTheme = (theme: State['theme']) => {
    dispatch(setTheme({ theme }));
  };

  const getName = () => name || '';
  const getAddress = () => (address ? formatWalletAddress(address) : undefined);

  const image = undefined; // @TODO fix mock

  return (
    <AccountSummary
      name={getName()}
      wallet={getAddress()}
      image={image}
      menu={[]}
      contentOnTop={innerWidth <= 1080}
      onLogout={logout}
      onLogin={() => {
        dispatch(setAuthModalVisible(true));
      }}
      onThemeChange={handleSetTheme}
    />
  );
};

export { UserHeader };
