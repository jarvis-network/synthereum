import React, { useState } from 'react';

import { ColoredTabs } from '@/components/ColoredTabs';
import { ChartCard } from '@/components/chart/ChartCard';
import { ExchangeCard } from '@/components/exchange/ExchangeCard';
import { useReduxSelector } from '@/state/useReduxSelector';
import { useDispatch } from 'react-redux';
import { setMobileTab } from '@/state/slices/app';

export const ChartExchangeCards: React.FC = props => {
  const mobileTab = useReduxSelector(state => state.app.mobileTab);
  const dispatch = useDispatch();

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
