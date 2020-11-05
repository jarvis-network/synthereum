import React from 'react';
import { useDispatch } from 'react-redux';
import { styled } from '@jarvis-network/ui';

import { setPay } from '@/state/slices/exchange';
import { useReduxSelector } from '@/state/useReduxSelector';

const Container = styled.button`
  grid-area: max;
  justify-self: end;
  font-size: 8px;
  color: ${props => props.theme.text.secondary};
  border: none;
  padding: 0;
  background: none;
  outline: none !important;
  text-transform: uppercase;
  cursor: pointer;
`;

const Max: React.FC = () => {
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
  };
  return <Container onClick={handleClick}>Max: {max}</Container>;
};

export default Max;
