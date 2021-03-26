import React from 'react';
import { styled, themeValue } from '@jarvis-network/ui';

const Container = styled.button`
  color: ${themeValue(
    {
      light: theme => theme.text.secondary,
    },
    theme => theme.text.medium,
  )};
  border: 1px solid ${props => props.theme.border.secondary};
  padding: 5px 7px;
  border-radius: ${props => props.theme.borderRadius.s};
  background: transparent;
  outline: none !important;
  text-transform: uppercase;
  cursor: pointer;
  margin-top: 8px;
  font-size: ${props => props.theme.font.sizes.m};
  font-family: Krub;
  font-weight: 300;
`;

interface Props {
  onClick: () => void;
}

export const Max: React.FC<Props> = ({ onClick }) => (
  <Container onClick={onClick}>Max</Container>
);
