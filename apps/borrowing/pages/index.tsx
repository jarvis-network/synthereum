import React from 'react';

import { Background, styled, styledScrollbars } from '@jarvis-network/ui';
import { UserHeader } from '@/components/header/UserHeader';
import { MarketsGrid } from '@/components/markets/Grid';

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
  overflow-y: auto;
  padding: 40px 60px 40px calc(50vw - 710px);
  box-sizing: border-box;
  background: ${props => props.theme.background.secondary};

  ${props =>
    styledScrollbars(props.theme, {
      background: props.theme.background.secondary,
    })}
`;

const LayoutWidget = styled(Background)`
  height: calc(100vh - 80px);
  min-height: 720px;
  padding: 40px calc(50vw - 710px) 40px 60px;
  box-sizing: content-box;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  width: 360px;
`;

export default function Home() {
  return (
    <Layout>
      <LayoutChart>
        <MarketsGrid />
      </LayoutChart>
      <LayoutWidget image="/images/light-mode-background.jpg">
        <UserHeader />
      </LayoutWidget>
    </Layout>
  );
}
