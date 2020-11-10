import React from 'react';
import { Header, styled } from '@jarvis-network/ui';

import { NextLinkAdapter } from '@/components/NextLink';
import { rightRenderer } from '@/components/header/rightRenderer';

const Container = styled.div`
  height: 100%;
  display: flex;
  flex-direction: column;
`;

const HeaderContainer = styled.div`
  border-style: solid;
  border-color: ${props => props.theme.border.secondary};
  border-width: 0;
  border-bottom-width: 1px;

  img[alt='Logo'] {
    height: 30px;
    margin-left: 15px;
  }

  @media (max-width: 720px) {
    order: 1;
    border-bottom-width: 0;
  }
`;

const CustomHeader = styled(Header)`
  padding-top: 0;
  padding-bottom: 0;
  height: 52px;
  grid-template-columns: auto auto auto;
`;

const Content = styled.div`
  overflow-y: auto;
  flex: 1;
`;

export const StickyHeader = ({ children }) => {
  return (
    <Container>
      <HeaderContainer>
        <CustomHeader
          leftSide={{ menu: [] }}
          rightSide={rightRenderer}
          link={NextLinkAdapter}
          logoUrl="/images/logo.svg"
        />
      </HeaderContainer>
      <Content className="content">{children}</Content>
    </Container>
  );
};
