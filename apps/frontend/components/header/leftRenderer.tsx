import React from 'react';
import {
  styled,
  getButtonStyles,
  ButtonModifierProps,
} from '@jarvis-network/ui';

const Button = styled.a<ButtonModifierProps>(props =>
  getButtonStyles(props, props.theme),
);
const CustomButton = styled(Button)`
  @media screen and (max-width: 400px) {
    display: none;
  }
`;

const render = () => (
  <CustomButton
    size="m"
    href="https://www.mtpelerin.com/bridge-wallet"
    target="_blank"
  >
    Buy with fiat
  </CustomButton>
);

export const leftRenderer = { render };
