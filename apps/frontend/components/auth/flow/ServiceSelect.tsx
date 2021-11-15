import React from 'react';
import Link from 'next/link';
import { PageProps } from '@/components/auth/flow/types';
import {
  BigP,
  Img,
  TutorialContent,
  ImgContainer,
  ChevronRight,
} from '@/components/auth/flow/ModalComponents';
import { Button, Flag, styled, themeValue } from '@jarvis-network/ui';

const TermsContainer = styled.div`
  display: flex;
  margin-top: 10px;

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

const Footer = styled.div`
  margin-top: 40px;

  display: flex;

  padding: 15px 35px;
  background: ${props => props.theme.background.medium};
  font-size: ${props => props.theme.font.sizes.xs};

  > :first-child {
    margin-right: 20px;

    img {
      width: 16px;
      height: 16px;
    }
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

const CustomLink = styled.a`
  color: ${props => props.theme.tooltip.text};
  text-decoration: none;
`;

const ServiceTutorialContent = styled(TutorialContent)`
  padding-bottom: 0;
  padding-left: 0;
  padding-right: 0;
`;

const Content = styled.div`
  padding: 0 25px;
`;

export const ServiceSelect: React.FC<PageProps> = ({ onNext }) => (
  <ServiceTutorialContent>
    <ImgContainer>
      <Img src="/images/welcome-statue.svg" alt="" />
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
    <Footer>
      <div>
        <Flag flag="USDC" />
      </div>
      <div>
        You will need <b>USDC</b> to interact with our <b>application</b>.
        <br />
        USDC is a tokenized version of the dollar.{' '}
        <Link href="https://www.circle.com/en/usdc" passHref>
          <CustomLink target="_blank">Read more.</CustomLink>
        </Link>
      </div>
    </Footer>
  </ServiceTutorialContent>
);
