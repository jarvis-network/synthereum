import React, { useContext, useEffect } from 'react';
import { useDispatch } from 'react-redux';

import { RealmAgentContext } from '@/components/auth/AuthProvider';
import { StickyHeader } from '@/components/header/StickyHeader';
import { backgroundMap } from '@/data/backgrounds';
import { Background } from '@/components/Background';
import { CardsHolder } from '@/components/CardsHolder';

import { ExchangeCard } from '@/components/exchange/ExchangeCard';
import { ChartCard } from '@/components/chart/ChartCard';
import { useReduxSelector } from '@/state/useReduxSelector';
import { subscribeAllPrices, closeConnection } from '@/state/slices/prices';
import { subscribeTransactionsHistory } from '@/state/slices/transactions';
import { subscribeWalletBalances } from '@/state/slices/wallet';

export default function Home() {
  const dispatch = useDispatch();
  const theme = useReduxSelector(state => state.theme);
  const realmAgent = useContext(RealmAgentContext);
  const url = backgroundMap[theme];

  useEffect(() => {
    dispatch(subscribeAllPrices());

    // eslint-disable-next-line consistent-return
    return () => {
      dispatch(closeConnection());
    };
  }, []);

  useEffect(() => {
    if (!realmAgent) {
      return;
    }

    dispatch(subscribeWalletBalances(realmAgent));
    dispatch(subscribeTransactionsHistory(realmAgent));
  }, [realmAgent]);

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
