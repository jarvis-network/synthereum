import React from 'react';
import { styled } from '@jarvis-network/ui';

interface Props {
  onClick: () => void;
}

const Button = styled.button`
  display: block;
  padding: 0 15px;
  border: 1px solid ${props => props.theme.border.primary};
  background: ${props => props.theme.background.primary};
  color: ${props => props.theme.text.primary};
  font-weight: 700;
  text-align: left;
  font-size: 15px;
  height: 36px;
  width: 195px;
  font-family: inherit;
  cursor: pointer;
  outline: none;
`;

export const SignInUpButton: React.FC<Props> = ({ onClick }) => {
  return <Button onClick={onClick}>Sign in / Sign up</Button>;
};
