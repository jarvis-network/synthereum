import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AnyAction } from 'redux';
import { useDispatch, useSelector } from 'react-redux';
import {
  Modal,
  styled,
  useNotifications,
  useIsMobile,
  noop,
  NotificationType,
  NotificationTypeWithOptions,
} from '@jarvis-network/ui';
import { EnhancedStore } from '@reduxjs/toolkit';
import { UnsupportedChainIdError } from '@web3-react/core';

import { usePrevious } from '../usePrevious';
import {
  logoutAction,
  networkSwitchAction,
  addressSwitchAction,
} from '../sharedActions';

import { useAuth, weakMapConnectors, Connectors } from './AuthContext';
import { WalletPicker } from './WalletPicker';
import { UnsupportedNetwork } from './UnsupportedNetwork';
import { useWeb3 } from './useWeb3';

const ModalWrapper = styled.div`
  @media screen and (max-width: ${props =>
      props.theme.rwd.breakpoints[props.theme.rwd.desktopIndex - 1]}px) {
    .auth-modal {
      justify-content: flex-end;
      background: none;

      > * {
        height: auto;
        padding-bottom: 30px;
      }
    }
  }
`;

interface PageProps {
  onNext(): void;
  onPrev(): void;
}

type Page = React.ComponentClass<PageProps> | React.FC<PageProps>;

type GetState<T> = T extends EnhancedStore<infer U> ? U : never;

interface Props {
  appName: string;
  // eslint-disable-next-line react/require-default-props
  notify?: (
    notify: ReturnType<typeof useNotifications>,
    isMobile: boolean,
    text: string,
    type?: NotificationTypeWithOptions,
    time?: number,
  ) => void;
  setAuthModalVisibleAction: (isVisible: boolean) => AnyAction;
  Welcome: Page;
  Terms: Page;
  ServiceSelect: Page;
}

export function AuthFlow<
  Store extends EnhancedStore<{
    app: { isAuthModalVisible: boolean };
  }>
>({
  appName,
  notify,
  setAuthModalVisibleAction,
  Welcome,
  Terms,
  ServiceSelect,
}: Props): JSX.Element {
  const {
    error,
    active,
    account: address,
    chainId: networkId,
    library: web3,
    connector,
  } = useWeb3();

  const dispatch = useDispatch();

  const previousActive = usePrevious(active);
  useEffect(() => {
    if (active) {
      const walletName = weakMapConnectors.get(
        connector as Connectors[keyof Connectors],
      );
      if (walletName) {
        localStorage.setItem('jarvis/auto-login', walletName);
      }
      return;
    }
    if (!previousActive) return;

    localStorage.removeItem('jarvis/auto-login');
    dispatch(logoutAction());
  }, [active, previousActive, dispatch, connector]);

  const previousNetworkId = usePrevious(networkId);
  useEffect(() => {
    if (!previousNetworkId && networkId) return;
    if (previousNetworkId === networkId) return;
    dispatch(networkSwitchAction());
  }, [previousNetworkId, networkId, dispatch]);

  const previousAddress = usePrevious(address);
  useEffect(() => {
    if (!previousAddress && address) return;
    if (previousAddress === address) return;
    dispatch(addressSwitchAction());
  }, [previousAddress, address, dispatch]);

  const auth = useAuth();

  const notifyFn = useNotifications();
  const isMobile = useIsMobile();

  const postNotificationRef = useRef<
    (title: string, options?: NotificationTypeWithOptions) => void
  >(noop);
  useMemo(() => {
    postNotificationRef.current = (
      title: string,
      options?: NotificationTypeWithOptions,
    ) => {
      if (notify) {
        notify(notifyFn, isMobile, title, options);
      } else {
        notifyFn(title, options);
      }
    };
  }, [isMobile, notify, notifyFn]);

  const isAuthModalVisible = useSelector<GetState<Store>, boolean>(
    state => state.app.isAuthModalVisible,
  );

  const [current, setPage] = useState(0);
  const next = () => {
    if (current === 1) {
      localStorage.setItem(`${appName}/tos-accepted`, 'true');
    }
    setPage(p => p + 1);
  };
  const prev = () => setPage(p => p - 1);

  const pages = [Welcome, Terms, ServiceSelect, WalletPicker];
  const Page = pages[current];

  useEffect(() => {
    // just logged in
    if (!previousNetworkId) {
      if (address)
        postNotificationRef.current('You have successfully signed in', {
          type: NotificationType.success,
          icon: '👍🏻',
        });

      return;
    }
    // just logged out
    if (!networkId) return;
    // address has changed
    if (previousNetworkId === networkId) return;

    postNotificationRef.current('You have switched your network', {
      type: NotificationType.success,
      icon: '⚡️',
    });
  }, [address, previousNetworkId, networkId]);

  useEffect(() => {
    if (isAuthModalVisible) {
      if (localStorage.getItem(`${appName}/tos-accepted`) === 'true') {
        setPage(2);
        return;
      }
      setPage(0);
    }
  }, [appName, isAuthModalVisible]);

  const handleClose = useCallback(() => {
    dispatch(setAuthModalVisibleAction(false));
  }, [dispatch, setAuthModalVisibleAction]);

  useEffect(() => {
    const autoLoginWallet = localStorage.getItem(`jarvis/auto-login`);

    if (!autoLoginWallet) {
      return;
    }

    auth.login(autoLoginWallet as 'injected');
  }, [auth]);

  useEffect(() => {
    if (web3) {
      dispatch(setAuthModalVisibleAction(false));
    }
  }, [dispatch, setAuthModalVisibleAction, web3]);

  const isUnsupportedChain = error instanceof UnsupportedChainIdError;

  return (
    <ModalWrapper>
      <Modal
        isOpened={isUnsupportedChain || isAuthModalVisible}
        onClose={handleClose}
        overlayStyle={{ zIndex: 3 }}
        overlayClassName="auth-modal"
      >
        {isUnsupportedChain ? (
          <UnsupportedNetwork
            handleDismiss={() => {
              auth.logout();
              handleClose();
            }}
            handleSwitchWallet={() => {
              // event.preventDefault();
              setPage(3);
              auth.logout();
            }}
          />
        ) : (
          Page && <Page onNext={next} onPrev={prev} />
        )}
      </Modal>
    </ModalWrapper>
  );
}
