import React, { useEffect } from 'react';
import { AnyAction } from 'redux';
import { useDispatch, useSelector } from 'react-redux';
import { Button, Modal, styled } from '@jarvis-network/ui';
import { isSupportedNetwork } from '@jarvis-network/synthereum-contracts/dist/src/config';
import { EnhancedStore } from '@reduxjs/toolkit';

import { useAuth } from './AuthContext';
import { useBehaviorSubject } from './useBehaviorSubject';
import { useCoreObservables } from './CoreObservablesContext';

const ButtonsContainer = styled('div')`
  display: flex;
  justify-content: space-between;
`;

type GetState<T> = T extends EnhancedStore<infer U> ? U : never;

type Props = {
  setUnsupportedNetworkModalVisibleAction(payload: boolean): AnyAction;
  TutorialContent: React.ComponentClass | React.FC;
};

export function UnsupportedNetworkModal<
  Store extends EnhancedStore<{
    app: { isUnsupportedNetworkModalVisible: boolean };
  }>
>({
  setUnsupportedNetworkModalVisibleAction,
  TutorialContent,
}: Props): JSX.Element {
  const { logout, login } = useAuth();
  const dispatch = useDispatch();
  const networkId = useBehaviorSubject(useCoreObservables().networkId$);

  const isUnsupportedNetworkModalVisible = useSelector<
    GetState<Store>,
    boolean
  >(state => state.app.isUnsupportedNetworkModalVisible);

  useEffect(() => {
    if (networkId === 0) return;
    if (isSupportedNetwork(networkId)) {
      dispatch(setUnsupportedNetworkModalVisibleAction(false));
    }
  }, [networkId, dispatch]);

  return (
    <Modal
      isOpened={isUnsupportedNetworkModalVisible}
      onClose={handleDismiss}
      overlayStyle={{ zIndex: 3 }}
    >
      <TutorialContent>
        <h4>You must change networks</h4>

        <p>
          We&apos;ve detected that you need to switch your wallet&apos;s network
          to <b>mainnet</b> or <b>kovan</b>.
        </p>

        <p>
          <i>
            Some wallets may not support changing networks. If you can not
            change networks in your wallet you may consider switching to a
            different wallet.
          </i>
        </p>

        <ButtonsContainer>
          <Button size="s" inverted type="dark" onClick={handleSwitchWallet}>
            Switch Wallet
          </Button>
          <Button size="s" inverted type="dark" onClick={handleDismiss}>
            Dismiss
          </Button>
        </ButtonsContainer>
      </TutorialContent>
    </Modal>
  );

  function handleDismiss() {
    dispatch(setUnsupportedNetworkModalVisibleAction(false));
  }

  function handleSwitchWallet() {
    logout();
    dispatch(setUnsupportedNetworkModalVisibleAction(false));
    login();
  }
}
