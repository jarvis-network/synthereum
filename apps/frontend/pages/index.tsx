import React, { useContext, useEffect } from 'react';
import { useDispatch } from 'react-redux';

import { styled } from '@jarvis-network/ui';

import { RealmAgentContext } from '@/components/auth/AuthProvider';
import { StickyHeader } from '@/components/header/StickyHeader';
import { Background } from '@/components/Background';
import { ExchangeCard } from '@/components/exchange/ExchangeCard';
import { ChartCard } from '@/components/chart/ChartCard';
import { ChartExchangeCards } from '@/components/ChartExchangeCards';
import { ChooseAsset } from '@/components/exchange/ChooseAsset';
import { OnMobile } from '@/components/OnMobile';
import { OnDesktop } from '@/components/OnDesktop';
import { useReduxSelector } from '@/state/useReduxSelector';
import { subscribeAllPrices, closeConnection } from '@/state/slices/prices';
import { subscribeTransactionsHistory } from '@/state/slices/transactions';
import { subscribeWalletBalances } from '@/state/slices/wallet';
import { backgroundMap } from '@/data/backgrounds';

const Layout = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: center;
`;

const LayoutChart = styled.div`
  display: flex;
  flex: 1 1 0%;
  width: 100%;
  height: 100vh;
  padding: 90px 30px 30px calc(50vw - 510px);
  box-sizing: border-box;
`;

const LayoutWidget = styled(Background)`
  height: 100vh;
  padding: 90px calc(50vw - 510px) 30px 30px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  justify-content: center;
`;

const WidgetContainer = styled.div`
  width: 360px;
  max-height: 540px;
  height: 100%;
`;

export default function Home() {
  const dispatch = useDispatch();
  const theme = useReduxSelector(state => state.theme);
  const chooseAsset = useReduxSelector(
    state => state.exchange.chooseAssetActive,
  );
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
      <OnMobile>
        {chooseAsset ? <ChooseAsset /> : <ChartExchangeCards />}
      </OnMobile>
      <OnDesktop>
        <Layout>
          <LayoutChart>
            <ChartCard />
          </LayoutChart>
          <LayoutWidget image={url}>
            <WidgetContainer>
              {chooseAsset ? <ChooseAsset /> : <ExchangeCard />}
            </WidgetContainer>
          </LayoutWidget>
        </Layout>
      </OnDesktop>
    </StickyHeader>
  );
}
