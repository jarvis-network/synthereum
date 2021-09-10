import React from 'react';
import { Button, styled } from '@jarvis-network/ui';

import { LeftBorder } from './ui';

const ButtonsContainer = styled('div')`
  display: flex;
  justify-content: space-between;
`;

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
        to <b>mainnet</b>, <b>polygon (matic)</b>, or <b>kovan</b>.
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
