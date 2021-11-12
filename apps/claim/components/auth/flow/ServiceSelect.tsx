import React from 'react';
import { PageProps } from '@/components/auth/flow/types';
import {
  BigP,
  Img,
  TutorialContent,
  ImgContainer,
  ChevronRight,
} from '@/components/auth/flow/ModalComponents';
import { Button, styled, themeValue } from '@jarvis-network/ui';

const TermsContainer = styled.div`
  display: flex;
  margin-top: 10px;
  margin-left: -16px;

  > * {
    flex: 1;

    &:not(:first-child) {
      margin-left: 22px;
    }
  }
`;

const Btn = styled(Button)`
  font-size: ${props => props.theme.font.sizes.s};
  border-color: ${props => props.theme.border.primary};
  height: 52px;
  padding: 0 10px;
  display: flex;
  justify-content: flex-start;
  align-items: center;
  background: none;
  color: currentColor;
  border-color: ${themeValue(
    { light: theme => theme.border.primary },
    theme => theme.border.secondary,
  )};

  > span {
    flex: 1;
    margin-left: 15px;
  }
`;

const DiagonalIcons = styled.div`
  width: 22px;
  height: 22px;
  position: relative;
  top: -2px;

  img {
    &:first-child {
      position: relative;
      top: 10px;
    }

    width: 11px;
    height: 11px;
  }
`;

const Content = styled.div``;

export const ServiceSelect: React.FC<PageProps> = ({ onNext }) => (
  <TutorialContent>
    <ImgContainer>
      <Img src="/images/service-statue.svg" alt="" />
    </ImgContainer>

    <Content>
      <BigP>
        <b>No account</b> needed!
      </BigP>

      <TermsContainer>
        <Btn inverted type="dark" onClick={onNext}>
          <DiagonalIcons>
            <img src="/images/ledger.svg" alt="" />
            <img src="/images/metamask.svg" alt="" />
          </DiagonalIcons>
          <span>
            Sign Up/In
            <br />
            <b>with your wallet</b>
          </span>
          <ChevronRight />
        </Btn>
      </TermsContainer>
    </Content>
  </TutorialContent>
);
