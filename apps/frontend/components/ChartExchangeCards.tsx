import React from 'react';
import { useDispatch } from 'react-redux';

import { ColoredTabs } from '@/components/ColoredTabs';
import { ChartCard } from '@/components/chart/ChartCard';
import { ExchangeCard } from '@/components/exchange/ExchangeCard';
import { useReduxSelector } from '@/state/useReduxSelector';
import { setMobileTab } from '@/state/slices/app';

export const ChartExchangeCards: React.FC = () => {
  const dispatch = useDispatch();
  const mobileTab = useReduxSelector(state => state.app.mobileTab);

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
  return (
    <ColoredTabs tabs={tabs} selected={mobileTab} onChange={setSelected} />
  );
};
