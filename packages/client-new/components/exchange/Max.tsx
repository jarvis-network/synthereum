import React from 'react';
import { useDispatch } from 'react-redux';
import { styled, themeValue } from '@jarvis-network/ui';

import { setBase, setPay } from '@/state/slices/exchange';
import { useReduxSelector } from '@/state/useReduxSelector';
import { formatAmount } from '@jarvis-network/web3-utils/base/big-number';

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

  const { payAsset, asset } = useReduxSelector(state => {
    return {
      asset: state.assets.list.find(a => a.symbol === state.exchange.payAsset)!,
      payAsset: state.exchange.payAsset,
    };
  });

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

  const formattedMax = formatAmount(max, asset.decimals);

  const handleClick = () => {
    dispatch(setPay(formattedMax));
    dispatch(setBase('pay'));
  };
  return <Container onClick={handleClick}>Max: {formattedMax}</Container>;
};
