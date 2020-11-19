import React from 'react';
import { useDispatch } from 'react-redux';
import { styled, themeValue } from '@jarvis-network/ui';

import { setBase, setPay } from '@/state/slices/exchange';
import { useReduxSelector } from '@/state/useReduxSelector';

const Container = styled.button`
  grid-area: max;
  justify-self: end;
  font-size: 10px;
  color: ${themeValue(
    {
      light: theme => theme.text.secondary,
    },
    theme => theme.text.medium,
  )};
  border: none;
  padding: 0;
  background: none;
  outline: none !important;
  text-transform: uppercase;
  cursor: pointer;
`;

export const Max: React.FC = () => {
  const dispatch = useDispatch();

  const max = useReduxSelector(state => {
    const asset = state.exchange.payAsset;
    if (!asset) {
      return null;
    }
    const wallet = state.wallet[asset];
    if (!wallet) {
      return null;
    }

    return wallet.amount;
  });

  if (!max) {
    return null;
  }

  const handleClick = () => {
    dispatch(setPay(String(max)));
    dispatch(setBase('pay'));
  };
  return <Container onClick={handleClick}>Max: {max}</Container>;
};
