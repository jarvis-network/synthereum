import React from 'react';

import { StickyHeader } from '@/components/header/StickyHeader';
import { backgroundMap } from '@/data/backgrounds';
import { Background } from '@/components/Background';
import { CardsHolder } from '@/components/CardsHolder';

import { ExchangeCard } from '@/components/exchange/ExchangeCard';
import { ChartCard } from '@/components/chart/ChartCard';
import { useReduxSelector } from '@/state/useReduxSelector';
import { subscribeAllPrices, closeConnection } from '@/state/slices/prices';
import { useSubscriber } from '@/utils/useSubscriber';

export default function Home() {
  const theme = useReduxSelector(state => state.theme);
  const url = backgroundMap[theme];

  // Initialize global subscription for data
  useSubscriber(subscribeAllPrices, closeConnection);

  return (
    <StickyHeader>
      <Background image={url}>
        <CardsHolder>
          <ChartCard />
          <ExchangeCard />
        </CardsHolder>
      </Background>
    </StickyHeader>
  );
}
