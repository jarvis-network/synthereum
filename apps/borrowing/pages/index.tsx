import React from 'react';

import { Background, styled, styledScrollbars } from '@jarvis-network/ui';
import { UserHeader } from '@/components/header/UserHeader';
import { MarketsGrid } from '@/components/markets/Grid';

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

const Home = () => (
  <Layout>
    <LayoutGrid>
      <LayoutGridContainer>
        <MarketsGrid />
      </LayoutGridContainer>
    </LayoutGrid>
    <LayoutWidget image="/images/light-mode-background.jpg">
      <UserHeader />
    </LayoutWidget>
  </Layout>
);

export default Home;
