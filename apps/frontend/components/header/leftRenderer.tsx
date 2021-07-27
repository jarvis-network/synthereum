import React from 'react';
import { styled, Button } from '@jarvis-network/ui';

const CustomButton = styled(Button)`
  @media screen and (max-width: 400px) {
    display: none;
  }
`;

const render = () => (
  // eslint-disable-next-line react/jsx-no-target-blank
  <CustomButton
    size="m"
    href="https://www.mtpelerin.com/bridge-wallet"
    target="_blank"
    rel="noopener"
  >
    Buy with fiat
  </CustomButton>
);

export const leftRenderer = { render };
