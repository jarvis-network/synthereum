import React, { useContext, useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Modal } from '@jarvis-network/ui';

import { Welcome } from '@/components/auth/flow/Welcome';
import { Terms } from '@/components/auth/flow/Terms';
import { ServiceSelect } from '@/components/auth/flow/ServiceSelect';
import { AuthContext, Web3Context } from '@/components/auth/AuthProvider';
import { useReduxSelector } from '@/state/useReduxSelector';
import { setAuthModalVisible } from '@/state/slices/app';

const noop = () => undefined;

const AuthFlow: React.FC = ({ children }) => {
  const web3 = useContext(Web3Context);
  const authLogin = useContext(AuthContext);
  const dispatch = useDispatch();

  const { isAuthModalVisible } = useReduxSelector(state => state.app);

  const [current, setPage] = useState(0);
  const next = () => setPage(p => p + 1);
  const prev = () => setPage(p => p - 1);

  const pages = [Welcome, Terms, ServiceSelect];
  const Page = pages[current];

  useEffect(() => {
    if (isAuthModalVisible) {
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
    (async () => {
      const autoLoginWallet = localStorage.getItem('jarvis/autologin');
      if (autoLoginWallet) {
        authLogin?.login(autoLoginWallet).catch(noop);
      }
    })();
  }, []);

  useEffect(() => {
    if (web3) {
      dispatch(setAuthModalVisible(false));
    }
  }, [web3]);

  return (
    <Modal
      isOpened={isAuthModalVisible}
      onClose={handleClose}
      overlayStyle={{ zIndex: 3 }}
    >
      {Page && <Page onNext={next} onPrev={prev} />}
    </Modal>
  );
};

export { AuthFlow };
