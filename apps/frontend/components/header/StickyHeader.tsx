import React from 'react';
import { Header, styled } from '@jarvis-network/ui';

import { NextLinkAdapter } from '@/components/NextLink';
import { rightRenderer } from '@/components/header/rightRenderer';

import { useReduxSelector } from '@/state/useReduxSelector';

import { leftRenderer } from '@/components/header/leftRenderer';

import { AccountOverviewModal } from './AccountOverviewModal';
import { RecentActivityModal } from './RecentActivityModal';

const Container = styled.div`
  height: 100%;
  display: flex;
  flex-direction: column;
`;

const HeaderContainer = styled.div<{ isAuthModalVisible: boolean }>`
  position: absolute;
  top: 0;
  bottom: auto;
  left: 0;
  right: 0;
  @media screen and (max-width: ${props =>
      props.theme.rwd.breakpoints[props.theme.rwd.desktopIndex - 1]}px) {
    ${props => (props.isAuthModalVisible ? 'display: none;' : '')}
  }

  .header-logo {
    height: 25px;
    margin-left: 15px;

    @media screen and (max-width: 319px) {
      display: none;
    }
  }

  @media screen and (max-width: ${props =>
      props.theme.rwd.breakpoints[props.theme.rwd.desktopIndex - 1]}px) {
    top: auto;
    bottom: 0;
    left: 0;
    right: 0;
    background: ${props => props.theme.background.primary};
    border-top: 1px solid ${props => props.theme.border.primary};
    z-index: 3;
  }
`;

const CustomHeader = styled(Header)`
  padding-top: 0;
  padding-bottom: 0;
  padding-left: calc(50vw - 520px);
  padding-right: calc(50vw - 520px);
  height: 90px;
  grid-template-columns: auto 1fr auto;

  @media screen and (max-width: ${props =>
      props.theme.rwd.breakpoints[props.theme.rwd.desktopIndex - 1]}px) {
    height: 52px;
  }
`;

const Content = styled.div`
  overflow-y: auto;
  overflow-x: hidden;
  flex: 1;
`;

export const StickyHeader: React.FC = ({ children }) => {
  const { isAuthModalVisible } = useReduxSelector(state => state.app);

  return (
    <Container>
      <HeaderContainer isAuthModalVisible={isAuthModalVisible}>
        <CustomHeader
          leftSide={leftRenderer}
          rightSide={rightRenderer}
          link={NextLinkAdapter}
          logoUrl="/images/logo.svg"
        />
      </HeaderContainer>
      <Content className="content">{children}</Content>
      <AccountOverviewModal />
      <RecentActivityModal />
    </Container>
  );
};
