import React from 'react';
import { useDispatch } from 'react-redux';
import { styled, themeValue } from '@jarvis-network/ui';

import { setBase, setPay } from '@/state/slices/exchange';
import { useReduxSelector } from '@/state/useReduxSelector';

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

export const Max: React.FC = () => {
  const dispatch = useDispatch();

  const payAsset = useReduxSelector(state => state.exchange.payAsset);

  const max = useReduxSelector(state => {
    if (!payAsset) {
      return null;
    }
    const wallet = state.wallet[payAsset];
    if (!wallet) {
      return null;
    }

    return wallet.amount;
  });

  if (!max) {
    return null;
  }

  const handleClick = () => {
    dispatch(setPay(max.format()));
    dispatch(setBase('pay'));
  };
  return <Container onClick={handleClick}>Max</Container>;
};
