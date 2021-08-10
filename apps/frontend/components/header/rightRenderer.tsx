import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch } from 'react-redux';
import {
  AccountSummary,
  NotificationType,
  useWindowSize,
  styled,
  Skeleton,
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
  setRecentActivityModalVisible,
} from '@/state/slices/app';
import { avatar } from '@/utils/avatar';
import { useReduxSelector } from '@/state/useReduxSelector';
import { isAppReadySelector } from '@/state/selectors';
import { useExchangeNotifications } from '@/utils/useExchangeNotifications';
import { networkIdToName } from '@jarvis-network/core-utils/dist/eth/networks';

const containerHeight = 38;
const Container = styled.div<{ hasContent?: boolean }>`
  height: ${containerHeight}px;
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
  const notify = useExchangeNotifications();

  const networkId = useBehaviorSubject(useCoreObservables().networkId$);

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

  const links = [
    {
      name: 'Account',
      key: 'Account',
      onClick() {
        dispatch(setAccountOverviewModalVisible(true));
      },
    },
    {
      name: 'Activity',
      key: 'Activity',
      onClick() {
        dispatch(setRecentActivityModalVisible(true));
      },
    },
  ];

  const onHelp = () =>
    window.open('https://help.jarvis.exchange/en/', '_blank', 'noopener');

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

  const networkProp = networkId ? networkIdToName[networkId as 1] : undefined;

  const content = isApplicationReady ? (
    <AccountSummary
      name={isSigningOut ? '' : name || ''}
      wallet={getAddress()}
      image={image}
      menu={links}
      network={networkProp === 'mainnet' ? 'ethereum' : networkProp}
      contentOnTop={innerWidth <= 1080}
      onLogout={
        isSigningOut
          ? noop
          : () => {
              logout();
              setSigningOut(true);
            }
      }
      onLogin={
        isSigningOut
          ? noop
          : () => {
              dispatch(setAuthModalVisible(true));
            }
      }
      onThemeChange={theme => {
        dispatch(setTheme({ theme }));
      }}
      onHelp={onHelp}
    />
  ) : null;

  return content ? (
    <Container hasContent>{content}</Container>
  ) : (
    <Skeleton
      variant="rectangular"
      sx={{ borderRadius: `${containerHeight / 2}px` }}
    >
      <Container />
    </Skeleton>
  );
};

const rightRenderer = { render };
export { rightRenderer };
