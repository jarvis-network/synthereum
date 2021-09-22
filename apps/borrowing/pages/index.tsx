import React, { useEffect } from 'react';

import { Background, styled, styledScrollbars } from '@jarvis-network/ui';
import { UserHeader } from '@/components/header/UserHeader';
import { MarketsGrid } from '@/components/markets/Grid';
import { useDispatch } from 'react-redux';
import { setWindowLoaded } from '@/state/slices/app';
import {
  parseSupportedNetworkId,
  SupportedNetworkName,
  SupportedSelfMintingPairExact,
} from '@jarvis-network/synthereum-config';
import { getInfuraWeb3 } from '@jarvis-network/core-utils/dist/apis/infura';
import _ from 'lodash';
import { SelfMintingMarketAssets } from '@/state/slices/markets';

import { createContext } from '@jarvis-network/synthereum-ts/dist/epics/core';
import { getActiveMarkets } from '@jarvis-network/synthereum-ts/dist/epics/markets';
import { useReduxSelector } from '@/state/useReduxSelector';
import { SelfMintingRealmAgent } from '@jarvis-network/synthereum-ts/dist/core/realms/self-minting/agent';
import { AddressOn } from '@jarvis-network/core-utils/dist/eth/address';

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
  const auth = useReduxSelector(state => state.auth?.address);

  useEffect(() => {
    if (auth) {
      dispatch({
        type: 'transaction/reset',
      });
      dispatch({
        type: 'approvalTransaction/reset',
      });
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
  }, [auth]);
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
          {markets ? <MarketsGrid markets={markets} /> : null}
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
  const { realm, chainLinkPriceFeed } = await createContext(web3);
  const realmAgent = new SelfMintingRealmAgent(
    realm!,
    '0x0000000000000000000000000000000000000000' as AddressOn<SupportedNetworkName>,
    'v1',
  );

  const assets = await getActiveMarkets({ selfMintingRealmAgent: realmAgent });
  const marketSymbols = [
    ...Object.keys(assets),
  ] as SupportedSelfMintingPairExact[];
  await chainLinkPriceFeed!.init();
  await Promise.all(
    marketSymbols.map(async marketSymbol => {
      const price = await chainLinkPriceFeed!.getPrice(marketSymbol);
      if (price) {
        assets[marketSymbol]!.price = price;
      }
    }),
  );

  return {
    props: {
      markets: assets,
    },
  };
}
export default Home;
