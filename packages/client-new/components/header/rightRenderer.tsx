import React, { useContext, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { AccountDropdown, styled } from '@jarvis-network/ui';

import SignInUpButton from '@/components/header/SignInUpButton';
import { AuthContext } from '@/components/auth/AuthProvider';
import { State } from '@/state/initialState';
import { setTheme } from '@/state/slices/theme';
import avatar from '@/utils/avatar';
import usePrettyName from '@/utils/usePrettyName';

const noop = () => undefined;

const cutWalletAddress = (address: string) => {
  const start = address.substr(0, 6);
  const end = address.substr(address.length - 4);

  return `${start}...${end}`;
};

// @TODO move to ui lib
const StyledAccountDropdown = styled(AccountDropdown)`
  > :last-child {
    z-index: 1;
  }
`;

const render = () => {
  const dispatch = useDispatch();
  const auth = useSelector((state: State) => state.auth);
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

  const links = [
    {
      name: 'Account',
      key: 'Account',
      // eslint-disable-next-line no-alert
      onClick: () => alert('Account'),
    },
    {
      name: 'Activity',
      key: 'Activity',
      // eslint-disable-next-line no-alert
      onClick: () => alert('Activity'),
    },
    {
      name: 'Help',
      key: 'Help',
      // eslint-disable-next-line no-alert
      onClick: () => alert('Help'),
    },
  ];

  if (auth.address) {
    const addr = cutWalletAddress(auth.address);
    return (
      <StyledAccountDropdown
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
      />
    );
  }
  return <SignInUpButton onClick={logIn} />;
};

const rightRenderer = { render };
export default rightRenderer;
