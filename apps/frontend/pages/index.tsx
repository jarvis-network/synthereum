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
