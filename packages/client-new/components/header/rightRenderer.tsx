import React, { useContext, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { AccountDropdown } from '@jarvis-network/ui';

import { SignInUpButton } from '@/components/header/SignInUpButton';
import { AuthContext } from '@/components/auth/AuthProvider';
import { setTheme } from '@/state/slices/theme';
import {
  setAccountDropdownExpanded,
  setAccountOverviewModalVisible,
  setRecentActivityModalVisible,
} from '@/state/slices/app';
import { avatar } from '@/utils/avatar';
import { formatWalletAddress } from '@/utils/format';
import { usePrettyName } from '@/utils/usePrettyName';
import { useReduxSelector } from '@/state/useReduxSelector';

const noop = () => undefined;

const render = () => {
  const dispatch = useDispatch();
  const auth = useReduxSelector(state => state.auth);
  const isAccountDropdownExpanded = useReduxSelector(state => state.app.isAccountDropdownExpanded);
  const authLogin = useContext(AuthContext);
  const name = usePrettyName(auth.address);

  const logIn = async () => {
    await authLogin.login();
  };

  useEffect(() => {
    const autoLoginWallet = localStorage.getItem('jarvis/autologin');
    if (autoLoginWallet) {
      authLogin.login(autoLoginWallet).catch(noop);
    }
  }, []);

  const handleSetTheme = theme => {
    dispatch(setTheme({ theme }));
  };

  const handleAccountOverviewOpen = () => {
    dispatch(setAccountOverviewModalVisible(true));
    dispatch(setAccountDropdownExpanded(false));
  };

  const handleRecentActivityOpen = () => {
    dispatch(setRecentActivityModalVisible(true));
    dispatch(setAccountDropdownExpanded(false));
  };

  const handleSetExpanded = (value: boolean) => {
    dispatch(setAccountDropdownExpanded(value));
  };

  const links = [
    {
      name: 'Account',
      key: 'Account',
      onClick: handleAccountOverviewOpen,
    },
    {
      name: 'Activity',
      key: 'Activity',
      onClick: handleRecentActivityOpen,
    },
    {
      name: 'Help',
      key: 'Help',
      // eslint-disable-next-line no-alert
      onClick: () => alert('Help'),
    },
  ];

  if (auth.address) {
    const addr = formatWalletAddress(auth.address);
    return (
      <AccountDropdown
        width="195px"
        links={links}
        position="absolute"
        name={name || ''}
        wallet={addr}
        onLogout={authLogin.logout}
        onModeChange={() => null}
        onThemeChange={handleSetTheme}
        mode="demo"
        image={avatar(auth.address)}
        isExpanded={isAccountDropdownExpanded}
        setExpanded={handleSetExpanded}
      />
    );
  }
  return <SignInUpButton onClick={logIn} />;
};

const rightRenderer = { render };
export { rightRenderer };
