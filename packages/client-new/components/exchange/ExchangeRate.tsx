import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Button, styled } from '@jarvis-network/ui';

import ExchangeRateIcon from '@/components/exchange/ExchangeRateIcon';
import { State } from '@/state/initialState';

const Container = styled.div`
  display: grid;
  grid-template-columns: auto auto;
  grid-template-rows: auto;
  grid-template-areas: 'rate assets';

  color: ${props => props.theme.text.secondary};
  font-size: 12px;
  padding-left: 15px;
  padding-right: 10px;
`;

const Rate = styled.div`
  grid-area: rate;
`;

const Assets = styled.div`
  grid-area: assets;
  justify-self: end;
`;

const ExchangeRate = props => {
  const rate = useSelector((state: State) => state.exchange.rate);
  const payAsset = useSelector((state: State) => state.exchange.payAsset);
  const receiveAsset = useSelector(
    (state: State) => state.exchange.receiveAsset,
  );

  if (!payAsset || !receiveAsset) {
    return null;
  }

  return (
    <Container>
      <Rate>{rate}</Rate>
      <Assets>
        {payAsset} per {receiveAsset} <ExchangeRateIcon />
      </Assets>
    </Container>
  );
};

export default ExchangeRate;
