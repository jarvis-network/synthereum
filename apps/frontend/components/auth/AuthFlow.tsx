import React, { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import {
  Modal,
  NotificationType,
  styled,
  useIsMobile,
  useNotifications,
} from '@jarvis-network/ui';
import Onboard from 'bnc-onboard';
import Web3 from 'web3';

import { Welcome } from '@/components/auth/flow/Welcome';
import { Terms } from '@/components/auth/flow/Terms';
import { ServiceSelect } from '@/components/auth/flow/ServiceSelect';
import { useReduxSelector } from '@/state/useReduxSelector';
import { setAuthModalVisible } from '@/state/slices/app';
import { authFactory, useAuth } from '@/utils/useAuth';
import {
  ENSHelper,
  getOnboardConfig,
  useBehaviorSubject,
  useCoreObservables,
} from '@jarvis-network/app-toolkit';

const noop = () => undefined;

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

const AuthFlow: React.FC = () => {
  const { web3$, ens$, onboard$ } = useCoreObservables();
  const web3 = useBehaviorSubject(web3$);

  const dispatch = useDispatch();
  const auth = useAuth();
  const { login } = auth || {};

  const isMobile = useIsMobile();
  const notify = useNotifications();

  const { isAuthModalVisible } = useReduxSelector(state => state.app);

  const [current, setPage] = useState(0);
  const next = () => {
    if (current === 1) {
      localStorage.setItem('jarvis/tos-accepted', 'true');
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
      if (localStorage.getItem('jarvis/tos-accepted') === 'true') {
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

    dispatch(setAuthModalVisible(false));
  };

  useEffect(() => {
    if (!login) {
      return;
    }

    const autoLoginWallet = localStorage.getItem('jarvis/autologin');

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
        const place = isMobile ? 'global' : 'exchange';
        notify(
          'You have successfully signed in',
          {
            type: NotificationType.success,
            icon: '👍🏻',
          },
          place,
        );
      })
      .catch(noop);
  }, [login]);

  useEffect(() => {
    if (web3) {
      dispatch(setAuthModalVisible(false));
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
};

export { AuthFlow };
