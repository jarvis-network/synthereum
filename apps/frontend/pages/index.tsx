import React, { useEffect } from 'react';
import { useDispatch } from 'react-redux';

import { Background, OnDesktop, OnMobile, styled } from '@jarvis-network/ui';

import { StickyHeader } from '@/components/header/StickyHeader';
import {
  ExchangeCard,
  FULL_WIDGET_HEIGHT_PX,
} from '@/components/exchange/ExchangeCard';
import { ChartCard } from '@/components/chart/ChartCard';
import { ChartExchangeCards } from '@/components/ChartExchangeCards';
import { useReduxSelector } from '@/state/useReduxSelector';
import { setWindowLoaded } from '@/state/slices/app';
import { backgroundMap } from '@/data/backgrounds';
import { GetStaticProps } from 'next';
import { supportedNetworkIds } from '@jarvis-network/synthereum-contracts/dist/config/supported-networks';
import { loadRealm } from '@jarvis-network/synthereum-ts/dist/core/load-realm';
import { getInfuraWeb3 } from '@jarvis-network/core-utils/dist/apis/infura';
import { assertIsSupportedPoolVersion } from '@jarvis-network/synthereum-ts/dist/core/types/pools';
import {
  getSerializablePoolsFromRealm,
  SerializablePools,
} from '@jarvis-network/synthereum-ts/dist/core/realm-utils';

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
  min-height: 720px;
  padding: 90px 60px 30px calc(50vw - 510px);
  box-sizing: border-box;
`;

const LayoutWidget = styled(Background)`
  height: 100vh;
  min-height: 720px;
  padding: 90px calc(50vw - 510px) 30px 60px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  justify-content: center;
`;

const WidgetContainer = styled.div`
  width: 360px;
  height: ${FULL_WIDGET_HEIGHT_PX}px;
`;

const Rotate = styled.div`
  display: none;

  @media screen and (max-device-width: 1080px) and (orientation: landscape) {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 9;
    background: ${props => props.theme.background.secondary};
    color: ${props => props.theme.text.secondary};
    font-size: ${props => props.theme.font.sizes.l};
    display: flex;
    justify-content: center;
    align-items: center;
  }

  > span {
    font-size: ${props => props.theme.font.sizes.xxl};
    padding-right: 5px;
  }
`;

export default function Home(): JSX.Element {
  const dispatch = useDispatch();
  const theme = useReduxSelector(state => state.theme);
  const url = backgroundMap[theme];

  useEffect(() => {
    if (typeof window !== 'object') return;

    function handleLoad() {
      setTimeout(() => dispatch(setWindowLoaded(true)), 250);
      window.removeEventListener('load', handleLoad);
    }

    if (document.readyState === 'complete') {
      handleLoad();
    } else {
      window.addEventListener('load', handleLoad);
    }
  }, [dispatch]);

  return (
    <StickyHeader>
      <OnMobile>
        <ChartExchangeCards image={url} />
        <Rotate>
          <span>↺</span> Rotate your device to portrait mode
        </Rotate>
      </OnMobile>
      <OnDesktop>
        <Layout>
          <LayoutChart>
            <ChartCard />
          </LayoutChart>
          <LayoutWidget image={url}>
            <WidgetContainer>
              <ExchangeCard />
            </WidgetContainer>
          </LayoutWidget>
        </Layout>
      </OnDesktop>
    </StickyHeader>
  );
}

export const getStaticProps: GetStaticProps = async () => {
  const infuraProjectId = process.env.NEXT_PUBLIC_INFURA_API_KEY;
  const shouldLoad =
    process.env.NODE_ENV === 'production' ||
    process.env.NEXT_PUBLIC_DEV_MODE_LOAD_POOLS_ON_ALL_NETWORKS;

  if (infuraProjectId && shouldLoad) {
    const poolVersion = assertIsSupportedPoolVersion(
      process.env.NEXT_PUBLIC_POOL_VERSION,
    );
    const results = await Promise.all(
      supportedNetworkIds.map(async networkId => ({
        networkId,
        serializedPools: getSerializablePoolsFromRealm(
          await loadRealm(
            getInfuraWeb3(networkId, 'https', infuraProjectId),
            networkId,
            {
              [poolVersion]: null,
            },
          ),
          poolVersion,
        ),
      })),
    );

    const pools: Record<number, SerializablePools> = {};
    for (const result of results) {
      if (!result.serializedPools) continue;
      pools[result.networkId] = result.serializedPools;
    }

    return { props: { pools: { [poolVersion]: pools } }, revalidate: 3600 };
  }
  return { props: {} };
};
