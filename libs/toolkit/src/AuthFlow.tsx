import React, { useEffect, useState } from 'react';
import { AnyAction, Dispatch } from 'redux';
import { useDispatch, useSelector } from 'react-redux';
import {
  Modal,
  styled,
  useNotifications,
  useIsMobile,
  noop,
} from '@jarvis-network/ui';
import Onboard from 'bnc-onboard';
import Web3 from 'web3';

import { ENSHelper } from './ens';
import { useCoreObservables } from './CoreObservablesContext';
import { useBehaviorSubject } from './useBehaviorSubject';
import { getOnboardConfig } from './onboardConfig';

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

export function AuthFlow<
  State extends { app: { isAuthModalVisible: boolean } }
>({
  appName,
  notify,
  setAuthModalVisibleAction,
  useAuth,
  authFactory,
  Welcome,
  Terms,
  ServiceSelect,
}: {
  appName: string;
  notify: (
    notify: ReturnType<typeof useNotifications>,
    isMobile: boolean,
  ) => void;
  setAuthModalVisibleAction: (isVisible: boolean) => AnyAction;
  useAuth: () => { login: (wallet?: string) => Promise<boolean> } | null;
  authFactory: (
    onboard: ReturnType<typeof Onboard>,
    dispatch: Dispatch,
  ) => { logout: () => void };
  Welcome: Page;
  Terms: Page;
  ServiceSelect: Page;
}): JSX.Element {
  const { web3$, ens$, onboard$ } = useCoreObservables();
  const web3 = useBehaviorSubject(web3$);

  const dispatch = useDispatch();
  const auth = useAuth();
  const { login } = auth || {};

  const notifyFn = useNotifications();
  const isMobile = useIsMobile();

  const isAuthModalVisible = useSelector<State, boolean>(
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

  const pages = [Welcome, Terms, ServiceSelect];
  const Page = pages[current];

  useEffect(() => {
    const onboardInstance = Onboard({
      ...getOnboardConfig(),
      subscriptions: {
        wallet: wallet => {
          if (!wallet.provider) {
            const currentAuth = authFactory(onboardInstance, dispatch);
            currentAuth.logout();
            web3$.next(null);
            ens$.next(null);
            return;
          }
          const web3instance = new Web3(wallet.provider);
          web3$.next(web3instance);
          const ensInstance = new ENSHelper(web3instance);
          ens$.next(ensInstance);
        },
      },
    });
    onboard$.next(onboardInstance);
  }, []);

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
    if (!login) {
      return;
    }

    const autoLoginWallet = localStorage.getItem(`${appName}/autologin`);

    if (!autoLoginWallet) {
      return;
    }

    // Disable autologin for WalletConnect provider
    if (autoLoginWallet === 'WalletConnect') {
      return;
    }

    login(autoLoginWallet)
      .then(loginSuccessful => {
        if (!loginSuccessful) {
          return;
        }
        notify(notifyFn, isMobile);
        // notify('You have successfully signed in', {
        //   type: NotificationType.success,
        //   icon: '👍🏻',
        // });
      })
      .catch(noop);
  }, [login]);

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
