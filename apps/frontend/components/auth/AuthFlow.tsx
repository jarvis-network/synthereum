import React, { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Modal, styled, useTheme } from '@jarvis-network/ui';

import { Welcome } from '@/components/auth/flow/Welcome';
import { Terms } from '@/components/auth/flow/Terms';
import { ServiceSelect } from '@/components/auth/flow/ServiceSelect';
import { useReduxSelector } from '@/state/useReduxSelector';
import { setAuthModalVisible } from '@/state/slices/app';
import { useAuth } from '@/utils/useAuth';
import { useCoreObservables } from '@/utils/CoreObservablesContext';
import { useBehaviorSubject } from '@/utils/useBehaviorSubject';

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
  const web3 = useBehaviorSubject(useCoreObservables().web3$);
  const { login } = useAuth() || {};
  const dispatch = useDispatch();
  const theme = useTheme();

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
      return
    };

    const autoLoginWallet = localStorage.getItem('jarvis/autologin');

    if (!autoLoginWallet) {
      return
    };

    // Disable autologin for WalletConnect provider
    if (autoLoginWallet === 'WalletConnect') {
      return
    }

    login(autoLoginWallet).catch(noop);
  }, [login]);

  useEffect(() => {
    if (web3) {
      dispatch(setAuthModalVisible(false));
    }
  }, [web3]);

  useEffect(() => {
    const { name } = theme;
    Array.from(document.body.classList).forEach(cls => {
      if (cls.startsWith('theme-')) {
        document.body.classList.remove(cls);
      }
    });
    document.body.classList.add(`theme-${name}`);
  }, [theme.name]);

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
