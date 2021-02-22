import React from 'react';
import { useDispatch } from 'react-redux';
import { styled } from '@jarvis-network/ui';

import { ColoredTabs } from '@/components/ColoredTabs';
import { ChartCard } from '@/components/chart/ChartCard';
import { ExchangeCard } from '@/components/exchange/ExchangeCard';
import { useReduxSelector } from '@/state/useReduxSelector';
import { setMobileTab } from '@/state/slices/app';

interface Props {
  image: string;
}

const Background = styled.div<Props>`
  background: url(${props => props.image}) no-repeat;
  background-color: ${props => props.theme.background.medium};
  background-size: cover;
  height: 100%;
`;

export const ChartExchangeCards: React.FC<Props> = ({ image }) => {
  const dispatch = useDispatch();
  const mobileTab = useReduxSelector(state => state.app.mobileTab);
  const { isAuthModalVisible } = useReduxSelector(state => state.app);

  const setSelected = (value: number) => dispatch(setMobileTab(value));

  const tabs = [
    {
      title: 'Chart',
      content: <ChartCard />,
    },
    {
      title: 'Exchange',
      content: <ExchangeCard />,
    },
  ];

  if (isAuthModalVisible) {
    return <Background image={image} />;
  }

  return (
    <ColoredTabs tabs={tabs} selected={mobileTab} onChange={setSelected} />
  );
};
