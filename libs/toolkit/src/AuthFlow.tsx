import React, { useEffect, useRef, useState } from 'react';
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
import Onboard from 'bnc-onboard';
import Web3 from 'web3';
import {
  isSupportedNetwork,
  SupportedNetworkId,
  SupportedNetworkName,
} from '@jarvis-network/synthereum-config/dist';
import { EnhancedStore } from '@reduxjs/toolkit';

import { Web3On } from '@jarvis-network/core-utils/dist/eth/web3-instance';

import { AddressOn } from '@jarvis-network/core-utils/dist/eth/address';

import { ENSHelper } from './ens';
import { useCoreObservables } from './CoreObservablesContext';
import { useBehaviorSubject } from './useBehaviorSubject';
import { getOnboardConfig } from './onboardConfig';
import { authFactory, useAuthContext } from './AuthContext';
import { usePrevious } from './usePrevious';
import {
  newWeb3Context,
  emptyWeb3Context,
  onAddressUpdate,
} from './core-context';

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

export function AuthFlow<
  Store extends EnhancedStore<{
    app: { isAuthModalVisible: boolean };
    auth: null | { address: string };
  }>
>({
  appName,
  notify,
  setAuthModalVisibleAction,
  setUnsupportedNetworkModalVisibleAction,
  addressSwitchAction,
  networkSwitchAction,
  Welcome,
  Terms,
  ServiceSelect,
  defaultNetwork,
}: {
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
  setUnsupportedNetworkModalVisibleAction(payload: boolean): AnyAction;
  addressSwitchAction: (payload: { address: string }) => AnyAction;
  networkSwitchAction: (payload: { networkId: number }) => AnyAction;
  Welcome: Page;
  Terms: Page;
  ServiceSelect: Page;
  defaultNetwork: SupportedNetworkId;
}): JSX.Element {
  const { web3$, ens$, onboard$, networkId$ } = useCoreObservables();
  const web3 = useBehaviorSubject(web3$);
  const networkId = useBehaviorSubject(networkId$);

  const dispatch = useDispatch();
  const { auth, loginAction, logoutAction } = useAuthContext();

  const notifyFn = useNotifications();
  const isMobile = useIsMobile();
  function postNotification(
    title: string,
    options?: NotificationTypeWithOptions,
  ) {
    if (notify) {
      notify(notifyFn, isMobile, title, options);
    } else {
      notifyFn(title, options);
    }
  }

  const isAuthModalVisible = useSelector<GetState<Store>, boolean>(
    state => state.app.isAuthModalVisible,
  );
  const address = useSelector<GetState<Store>, string | undefined>(
    state => state.auth?.address,
  );

  const [current, setPage] = useState(0);
  const next = () => {
    if (current === 1) {
      localStorage.setItem(`${appName}/tos-accepted`, 'true');
    }
    setPage(p => p + 1);
  };
  const prev = () => setPage(p => p - 1);

  const pages = [Welcome, Terms, ServiceSelect];
  const Page = pages[current];
  const walletRef = useRef<any>(null);
  useEffect(() => {
    const onboard = Onboard({
      ...getOnboardConfig(defaultNetwork),
      subscriptions: {
        async wallet(wallet) {
          walletRef.current = wallet;
          if (!wallet.provider) {
            const currentAuth = authFactory(
              onboard,
              dispatch,
              loginAction,
              logoutAction,
            );
            currentAuth.logout();
            dispatch({
              type: 'transaction/reset',
            });
            dispatch({
              type: 'approvalTransaction/reset',
            });
            web3$.next(null);
            ens$.next(null);
            emptyWeb3Context();
            return;
          }
          const web3instance = new Web3(walletRef.current.provider);
          console.time('RealmLoaded');
          try {
            await newWeb3Context(web3instance as Web3On<SupportedNetworkId>);
            web3$.next(web3instance);
            console.timeEnd('RealmLoaded');
          } catch (error: any) {
            console.log(error);
            dispatch({
              type: 'app/realmError',
              payload: {
                message: error.message,
              },
            });
          }
          ens$.next(new ENSHelper(web3instance));
        },
        async address(newAddress) {
          dispatch(setAuthModalVisibleAction(false));
          if (walletRef.current) {
            try {
              await onAddressUpdate(
                newAddress as AddressOn<SupportedNetworkName>,
              );
            } catch (error: any) {
              console.log(error);
              dispatch({
                type: 'app/realmError',
                payload: {
                  message: error.message,
                },
              });
            }
          }

          dispatch(addressSwitchAction({ address: newAddress }));
        },
        network(newNetworkId) {
          if (!newNetworkId) return;

          dispatch(networkSwitchAction({ networkId: newNetworkId }));
          networkId$.next(newNetworkId);

          if (!isSupportedNetwork(newNetworkId)) {
            dispatch(setUnsupportedNetworkModalVisibleAction(true));
            return;
          }
          onboard.config({ networkId: newNetworkId });
        },
      },
    });
    onboard$.next(onboard);

    return () => onboard.walletReset();
  }, [web3$, ens$, dispatch]);

  const previousNetworkId = usePrevious(networkId);
  useEffect(() => {
    async function updateRealm() {
      // just logged in
      if (!previousNetworkId || !address) return;
      // just logged out
      if (!networkId) return;
      // address has changed
      if (previousNetworkId === networkId) return;
      dispatch(setAuthModalVisibleAction(false));
      try {
        const web3instance = new Web3(walletRef.current.provider);
        await newWeb3Context(web3instance as Web3On<SupportedNetworkId>);
        onAddressUpdate(address as AddressOn<SupportedNetworkName>);
      } catch (error: any) {
        console.log(error);
        dispatch({
          type: 'app/realmError',
          payload: {
            message: error.message,
          },
        });
      }
      postNotification('You have switched your network', {
        type: NotificationType.success,
        icon: '⚡️',
      });
    }
    updateRealm();
  }, [address, previousNetworkId, networkId]);

  const previousAddress = usePrevious(address);
  useEffect(() => {
    // just logged in
    if (!address || !previousAddress) return;
    // just logged out
    if (!address) return;

    // address has changed
    if (address === previousAddress) return;
    try {
      onAddressUpdate(address as AddressOn<SupportedNetworkName>);
    } catch (error: any) {
      console.log(error);
      dispatch({
        type: 'app/realmError',
        payload: {
          message: error.message,
        },
      });
    }
    postNotification('You have switched your address', {
      type: NotificationType.success,
      icon: '⚡️',
    });
  }, [address, previousAddress]);

  useEffect(() => {
    if (isAuthModalVisible) {
      if (localStorage.getItem(`${appName}/tos-accepted`) === 'true') {
        setPage(2);
        return;
      }
      setPage(0);
    }
  }, [isAuthModalVisible]);

  const handleClose = (elem?: EventTarget) => {
    if (
      elem &&
      (elem instanceof HTMLElement || elem instanceof SVGElement) &&
      elem.closest('.bn-onboard-modal')
    ) {
      return;
    }

    dispatch(setAuthModalVisibleAction(false));
  };

  useEffect(() => {
    const autoLoginWallet = localStorage.getItem(`jarvis/autologin`);

    if (!autoLoginWallet) {
      return;
    }

    // Disable autologin for WalletConnect provider
    if (autoLoginWallet === 'WalletConnect') {
      return;
    }

    auth
      .login(autoLoginWallet)

      .then(loginSuccessful => {
        if (!loginSuccessful) {
          return;
        }
        postNotification('You have successfully signed in', {
          type: NotificationType.success,
          icon: '👍🏻',
        });
      })
      .catch(noop);
  }, [auth]);

  useEffect(() => {
    if (web3) {
      dispatch(setAuthModalVisibleAction(false));
    }
  }, [web3]);

  return (
    <ModalWrapper>
      <Modal
        isOpened={isAuthModalVisible}
        onClose={handleClose}
        overlayStyle={{ zIndex: 3 }}
        overlayClassName="auth-modal"
      >
        {Page && <Page onNext={next} onPrev={prev} />}
      </Modal>
    </ModalWrapper>
  );
}
