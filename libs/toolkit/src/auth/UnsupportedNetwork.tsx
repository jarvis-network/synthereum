import React from 'react';
import { Button, styled } from '@jarvis-network/ui';

import { LeftBorder } from './ui';
import { supportedNetworkIds } from './env';

const ButtonsContainer = styled('div')`
  display: flex;
  justify-content: space-between;
`;

const networkIdToStringMap = {
  1: 'mainnet',
  137: 'polygon (matic)',
  42: 'kovan',
};

function networkIdToString(id: number) {
  return networkIdToStringMap[id as 1] || 'unknown';
}

const supportedNetworkIdsFragment =
  supportedNetworkIds.length === 1 ? (
    <b>{networkIdToString(supportedNetworkIds[0])}</b>
  ) : supportedNetworkIds.length === 2 ? (
    <>
      <b>{networkIdToString(supportedNetworkIds[0])}</b> or{' '}
      <b>{networkIdToString(supportedNetworkIds[1])}</b>
    </>
  ) : (
    supportedNetworkIds.reduce<(JSX.Element | string)[]>(
      (result, id, index, array) => {
        result.push(<b key={id}>{networkIdToString(id)}</b>);
        if (index === array.length - 2) {
          result.push(', or ');
        } else if (index !== array.length - 1) {
          result.push(', ');
        }
        return result;
      },
      [],
    )
  );

export function UnsupportedNetwork({
  handleDismiss,
  handleSwitchWallet,
}: {
  handleDismiss(): void;
  handleSwitchWallet(): void;
}): JSX.Element {
  return (
    <LeftBorder>
      <h4>You must change networks</h4>

      <p>
        We&apos;ve detected that you need to switch your wallet&apos;s network
        to {supportedNetworkIdsFragment}.
      </p>

      <p>
        <i>
          Some wallets may not support changing networks. If you can not change
          networks in your wallet you may consider switching to a different
          wallet.
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
    </LeftBorder>
  );
}
