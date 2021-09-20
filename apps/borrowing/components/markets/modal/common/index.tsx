import React from 'react';

import { Button, styled } from '@jarvis-network/ui';
import { motion } from 'framer-motion';

import { ActionVariants, tapAnimation } from './variants';

export const Link = styled.a`
  color: #0093ff;
  font-weight: bold;
  text-decoration: none;
`;

export const ExchangeBox = styled.div<{ error: boolean }>`
  margin: 5px 15px;
  display: grid;
  grid-template-columns: auto;
  grid-template-rows: auto;
  grid-template-areas:
    'title'
    'asset-select'
    'value';
  position: relative;
  margin-top: 15px;
  width: 90%;
`;

export const AssetSelect = styled.div<{ error: boolean }>`
  grid-area: asset-select;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 5px 20px 10px;
  height: ${props => props.theme.sizes.row};
  box-sizing: border-box;
  margin-top: 5px;
  border: 1px solid
    ${props =>
      !props.error ? props.theme.border.secondary : props.theme.border.invalid};
  border-radius: ${props => props.theme.borderRadius.s};
`;

export const Amount = styled.input`
  grid-area: amount;
  border: none;
  padding: none;
  background: none;
  color: ${props => props.theme.text.secondary};
  font-size: ${props => props.theme.font.sizes.l};
  width: 45%;
  outline: none !important;
  margin-top: 5px;
  margin-bottom: 5px;
  height: 100%;
  font-family: Krub;

  &::placeholder {
    color: currentColor;
  }
`;

export const AmountSmallPlaceholder = styled(Amount)`
  &::placeholder {
    font-size: 14px;
  }
`;

export const Balance = styled.div`
  color: ${props => props.theme.text.secondary};
  text-align: right;
  font-size: 18px;
  margin-right: 15px;
  grid-area: title;
`;

export const Value = styled.div`
  color: ${props => props.theme.text.secondary};
  text-align: right;
  font-size: 16px;
  margin-right: 15px;
  width: 300px;
  grid-area: value;
`;

export const ErrorMessage = styled.div`
  position: absolute;
  bottom: -14px;
  font-size: 8px;
  color: ${props => props.theme.text.invalid};
  left: 0;
`;

export const Form = styled.div`
  flex: 1;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  display: flex;
`;

export const SubmitContainer = styled.div`
  text-align: center;
`;

export const SubmitButtonInner = styled(Button)`
  font-size: 20px;
  height: 60px;
  min-width: 202px;
  text-align: center;
  text-transform: uppercase;

  &:disabled {
    color: ${props => props.theme.text.secondary};
  }
`;
export const Container = styled.div`
  width: 520px;
`;

const BtnContainer = styled(motion.div)`
  width: max-content;
  margin: 0px auto;
  height: max-content;
`;
export interface ButtonProps {
  animate?: ActionVariants;
  onClick: () => void;
}
export const SubmitButton: React.FC<ButtonProps> = ({
  children,
  animate = 'tap',

  onClick,
}) => (
  <BtnContainer whileTap="tap" animate={animate} variants={tapAnimation}>
    <SubmitButtonInner onClick={onClick}>{children}</SubmitButtonInner>
  </BtnContainer>
);

const allowedKeys = '0123456789.'.split('');

export const handleKeyPress = (
  e: React.KeyboardEvent<HTMLInputElement>,
  asset: { decimals: number },
) => {
  const somethingSelected =
    e.currentTarget.selectionStart !== e.currentTarget.selectionEnd;
  const parts = e.currentTarget.value.split('.');
  const decimals = parts[1] || '';

  if (
    !allowedKeys.includes(e.key) ||
    (e.key === '.' && e.currentTarget.value.includes('.')) ||
    (decimals.length >= asset.decimals && !somethingSelected)
  ) {
    e.preventDefault();
  }
};

export { Asset } from './Asset';
export { Max } from './Max';
