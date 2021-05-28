import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch } from 'react-redux';
import {
  AccountSummary,
  NotificationType,
  useNotifications,
  useWindowSize,
  styled,
  Skeleton,
  useIsMobile,
} from '@jarvis-network/ui';
import { Address } from '@jarvis-network/core-utils/dist/eth/address';
import {
  formatWalletAddress,
  usePrettyName,
  useAuth,
  useBehaviorSubject,
  useCoreObservables,
} from '@jarvis-network/app-toolkit';

import { setTheme } from '@/state/slices/theme';
import {
  setAccountOverviewModalVisible,
  setAuthModalVisible,
} from '@/state/slices/app';
import { avatar } from '@/utils/avatar';
import { useReduxSelector } from '@/state/useReduxSelector';
import { State } from '@/state/initialState';
import { isAppReadySelector } from '@/state/selectors';
import { isSupportedNetwork } from '@jarvis-network/synthereum-contracts/dist/src/config';
import { Network } from '@jarvis-network/core-utils/dist/eth/networks';

const Container = styled.div<{ hasContent: boolean }>`
  height: 38px;
  width: 310px;

  ${props =>
    props.hasContent
      ? ''
      : `
    border-radius: ${props.theme.borderRadius.m};
    overflow: hidden;
  `}

  @media screen and (max-width: ${props =>
    props.theme.rwd.breakpoints[props.theme.rwd.desktopIndex - 1]}px) {
    width: 185px;
  }
`;

const noop = () => undefined;

const render = (): JSX.Element => {
  const dispatch = useDispatch();
  const auth = useReduxSelector(state => state.auth);
  const isApplicationReady = useReduxSelector(isAppReadySelector);
  const { logout } = useAuth();
  const name = usePrettyName((auth?.address ?? null) as Address | null);
  const [isSigningOut, setSigningOut] = useState(false);
  const { innerWidth } = useWindowSize();
  const isMobile = useIsMobile();
  const notify = useNotifications();

  const handleLogIn = () => {
    dispatch(setAuthModalVisible(true));
  };

  const handleLogOut = () => {
    logout();
    setSigningOut(true);
  };

  const networkId = useBehaviorSubject(useCoreObservables().networkId$);
  const mode = auth
    ? networkId === Network.mainnet
      ? 'real'
      : isSupportedNetwork(networkId)
      ? 'demo'
      : undefined
    : undefined;

  const handleSetTheme = (theme: State['theme']) => {
    dispatch(setTheme({ theme }));
  };

  const handleAccountOverviewOpen = () => {
    dispatch(setAccountOverviewModalVisible(true));
  };

  useEffect(() => {
    if (isSigningOut) {
      setTimeout(() => {
        setSigningOut(false);
        const place = isMobile ? 'global' : 'exchange';

        notify(
          'You have successfully signed out',
          { type: NotificationType.error, icon: '👋🏻' },
          place,
        );
      }, 1000);
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

  const content = isApplicationReady ? (
    <AccountSummary
      name={getName()}
      wallet={getAddress()}
      image={image}
      menu={links}
      mode={mode}
      contentOnTop={innerWidth <= 1080}
      onLogout={isSigningOut ? noop : handleLogOut}
      onLogin={isSigningOut ? noop : handleLogIn}
      onThemeChange={handleSetTheme}
      onHelp={onHelp}
    />
  ) : null;

  return (
    <Container hasContent={!!content}>
      <Skeleton>{content}</Skeleton>
    </Container>
  );
};

const rightRenderer = { render };
export { rightRenderer };
