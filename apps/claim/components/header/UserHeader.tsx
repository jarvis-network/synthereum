import React from 'react';
import { useDispatch } from 'react-redux';
import { AccountSummary, useWindowSize } from '@jarvis-network/ui';

import { setTheme } from '@/state/slices/theme';
import { State } from '@/state/initialState';
import { useReduxSelector } from '@/state/useReduxSelector';
import { Address } from '@jarvis-network/core-utils/dist/eth/address';
import {
  formatWalletAddress,
  useAuth,
  usePrettyName,
} from '@jarvis-network/app-toolkit';

const UserHeader = (): JSX.Element => {
  const dispatch = useDispatch();
  const auth = useReduxSelector(state => state.auth);
  const { logout, login } = useAuth();
  const name = usePrettyName((auth?.address ?? null) as Address | null);
  const { innerWidth } = useWindowSize();

  const handleSetTheme = (theme: State['theme']) => {
    dispatch(setTheme({ theme }));
  };

  const getName = () => name || '';
  const getAddress = () =>
    auth ? formatWalletAddress(auth.address) : undefined;

  const image = undefined; // @TODO fix mock

  return (
    <AccountSummary
      name={getName()}
      wallet={getAddress()}
      image={image}
      menu={[]}
      contentOnTop={innerWidth <= 1080}
      onLogout={() => logout()}
      onLogin={() => login()}
      onThemeChange={handleSetTheme}
    />
  );
};

export { UserHeader };
