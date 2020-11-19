import React from 'react';
import { useDispatch } from 'react-redux';
import { styled } from '@jarvis-network/ui';

import { ExchangeRateIcon } from '@/components/exchange/ExchangeRateIcon';
import { useRate } from '@/utils/useRate';
import { invertRateInfo as invertRateInfoAction } from '@/state/slices/exchange';
import { useReduxSelector } from '@/state/useReduxSelector';
import { formatRate } from '@/utils/format';

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

export const ExchangeRate: React.FC = () => {
  const dispatch = useDispatch();
  const { payAsset, receiveAsset, invertRateInfo } = useReduxSelector(
    state => state.exchange,
  );

  const rate = invertRateInfo
    ? useRate(receiveAsset, payAsset)
    : useRate(payAsset, receiveAsset);

  if (!payAsset || !receiveAsset || !rate) {
    return null;
  }

  const handleInvertClick = () => {
    dispatch(invertRateInfoAction());
  };

  return (
    <Container>
      <Rate>{formatRate(rate.rate)}</Rate>
      <Assets>
        {invertRateInfo ? payAsset : receiveAsset} per{' '}
        {invertRateInfo ? receiveAsset : payAsset}
        <ExchangeRateIcon onClick={handleInvertClick} />
      </Assets>
    </Container>
  );
};
