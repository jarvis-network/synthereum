import React from 'react';
import { useDispatch } from 'react-redux';
import { styled } from '@jarvis-network/ui';

import { ExchangeRateIcon } from '@/components/exchange/ExchangeRateIcon';
import { useRate } from '@/utils/useRate';
import { invertRateInfo as invertRateInfoAction } from '@/state/slices/exchange';
import { useReduxSelector } from '@/state/useReduxSelector';

const Container = styled.div`
  display: flex;
  justify-content: flex-end;
  align-items: center;
  height: calc(${props => props.theme.font.sizes.m} * 1.4);
  color: ${props => props.theme.text.secondary};
  font-size: ${props => props.theme.font.sizes.m};
  padding-left: 15px;
  padding-right: 10px;
`;

const Rate = styled.div`
  grid-area: rate;
  padding-right: 10px;
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
    ? useRate(payAsset, receiveAsset)
    : useRate(receiveAsset, payAsset);

  if (!payAsset || !receiveAsset || !rate) {
    return <Container />;
  }

  const handleInvertClick = () => {
    dispatch(invertRateInfoAction());
  };

  return (
    <Container>
      <Rate>{rate.rate.format(5)}</Rate>
      <Assets>
        {invertRateInfo ? payAsset : receiveAsset} per{' '}
        {invertRateInfo ? receiveAsset : payAsset}
        <ExchangeRateIcon onClick={handleInvertClick} />
      </Assets>
    </Container>
  );
};
