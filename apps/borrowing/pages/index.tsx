import React, { useEffect } from 'react';

import { Background, styled, styledScrollbars } from '@jarvis-network/ui';
import { UserHeader } from '@/components/header/UserHeader';
import { MarketsGrid } from '@/components/markets/Grid';
import { useDispatch } from 'react-redux';
import { setWindowLoaded } from '@/state/slices/app';
import { parseSupportedNetworkId } from '@jarvis-network/synthereum-config';
import { getInfuraWeb3 } from '@jarvis-network/core-utils/dist/apis/infura';
import _ from 'lodash';
import { SelfMintingMarketAssets } from '@/state/slices/markets';

import { createContext } from '@jarvis-network/synthereum-ts/dist/epics/core';
import { getActiveMarkets } from '@jarvis-network/synthereum-ts/dist/epics/markets';
import { useReduxSelector } from '@/state/useReduxSelector';

const Layout = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: center;
`;

const LayoutGrid = styled.div`
  display: flex;
  flex: 1 1 0%;
  width: 100%;
  min-height: 720px;
  max-height: 100vh;
  padding-left: calc(50vw - 700px);
  box-sizing: border-box;
  background: ${props => props.theme.background.secondary};
`;

const LayoutGridContainer = styled.div`
  width: 100%;
  max-height: 100%;
  padding: 40px 60px 40px 0;

  ${props =>
    styledScrollbars(props.theme, {
      background: props.theme.background.secondary,
    })}
`;

const LayoutWidget = styled(Background)`
  height: calc(100vh - 80px);
  min-height: 720px;
  padding: 40px calc(50vw - 700px) 40px 60px;
  box-sizing: content-box;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  width: 360px;
`;

const Home = ({ markets }: { markets: SelfMintingMarketAssets }) => {
  const dispatch = useDispatch();
  const networkId = useReduxSelector(state => state.app.networkId);
  useEffect(() => {
    if (networkId) {
      dispatch({ type: 'GET_MARKET_LIST' });
      dispatch({
        type: 'GET_WALLET_BALANCE',
        payload: [],
      });
      dispatch({
        type: 'UPDATE_PAIRS',
        payload: [...Object.keys(markets), 'UMA', 'USDC'],
      });
    }
  }, [networkId]);
  useEffect(() => {
    function handleLoad() {
      setTimeout(() => dispatch(setWindowLoaded(true)), 250);
      window.removeEventListener('load', handleLoad);
    }

    window.addEventListener('load', handleLoad);
  }, []);

  return (
    <Layout>
      <LayoutGrid>
        <LayoutGridContainer>
          {markets ? (
            <MarketsGrid networkId={networkId} markets={markets} />
          ) : null}
        </LayoutGridContainer>
      </LayoutGrid>
      <LayoutWidget image="/images/light-mode-background.jpg">
        <UserHeader />
      </LayoutWidget>
    </Layout>
  );
};
/**
 * Use this tutorial for the SSR ad SSG
 * https://pagepro.co/blog/next-js-pre-rendering-and-data-fetching/
 *
 */
export async function getStaticProps() {
  // TOOD: Choose network dynamically
  const netId = parseSupportedNetworkId(1);
  const web3 = getInfuraWeb3(netId);
  const realm = await createContext(web3);
  const assets = await getActiveMarkets(realm);
  return {
    props: {
      markets: assets,
    },
  };
}
export default Home;
