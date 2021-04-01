import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Button, Checkbox, styled, themeValue } from '@jarvis-network/ui';

import { PageProps } from '@/components/auth/flow/types';
import {
  Img,
  TutorialContent,
  P,
  ImgContainer,
  ChevronRight,
  ModalHeader,
  ContentWrapper,
} from '@/components/auth/flow/ModalComponents';

import termsOfServiceText from '@/components/auth/flow/policies/tos.md';
import privacyPolicyText from '@/components/auth/flow/policies/pp.md';

const TermsContainer = styled.div`
  display: flex;
  margin-top: 10px;
  margin-left: -16px;

  @media screen and (max-width: ${props =>
      props.theme.rwd.breakpoints[props.theme.rwd.desktopIndex - 1]}px) {
    flex-direction: column;
  }

  > * {
    flex: 1;

    @media screen and (min-width: ${props =>
        props.theme.rwd.breakpoints[props.theme.rwd.desktopIndex - 1] + 1}px) {
      &:not(:first-child) {
        margin-left: 22px;
      }
    }

    @media screen and (max-width: ${props =>
        props.theme.rwd.breakpoints[props.theme.rwd.desktopIndex - 1]}px) {
      &:not(:first-child) {
        margin-top: 11px;
      }
    }
  }
`;

const Btn = styled(Button)`
  display: flex;
  border-color: ${themeValue(
    { light: theme => theme.background.secondary },
    theme => theme.border.secondary,
  )};
  height: 52px;
  background: none;
  color: currentColor;
  font-size: ${props => props.theme.font.sizes.l};

  @media screen and (max-width: ${props =>
      props.theme.rwd.breakpoints[props.theme.rwd.desktopIndex - 1]}px) {
    width: 100%;
  }

  > span {
    flex: 1;
  }
`;

const Footer = styled.div`
  margin-top: 20px;
  display: flex;
  align-items: center;
  margin-left: -16px;

  > :first-child {
    flex: 1;
  }
`;

const Submit = styled(Button)`
  font-size: 18px;
  width: 202px;
  text-align: center;
  height: 60px;
  margin-left: 20px;

  :not(:disabled) {
    ${props => (props.theme.name === 'light' ? 'color: black;' : '')}
  }
`;

export const Terms: React.FC<PageProps> = ({ onNext }) => {
  const [checked, setChecked] = useState(false);
  const [mode, setMode] = useState<'approve' | 'terms' | 'privacy'>('approve');

  const toggle = () => setChecked(p => !p);

  const approve = (
    <>
      <ImgContainer>
        <Img src="/images/terms-statue.svg" alt="" />
      </ImgContainer>

      <P>Please review the terms below before starting.</P>
      <TermsContainer>
        <Btn inverted type="dark" onClick={() => setMode('terms')} size="m">
          <span>Terms of Service</span>
          <ChevronRight />
        </Btn>
        <Btn inverted type="dark" onClick={() => setMode('privacy')} size="m">
          <span>Privacy Policy</span>
          <ChevronRight />
        </Btn>
      </TermsContainer>

      <Footer>
        <div>
          <Checkbox checked={checked} onChange={toggle} name="acc" />
        </div>
        {/* eslint-disable-next-line jsx-a11y/label-has-associated-control,jsx-a11y/label-has-for */}
        <label htmlFor="acc">I have read and understood the terms above</label>
        <Submit type="primary" disabled={!checked} onClick={onNext}>
          I agree
        </Submit>
      </Footer>
    </>
  );

  const terms = (
    <>
      <ModalHeader title="Terms of Service" onBack={() => setMode('approve')} />
      <ContentWrapper>
        <ReactMarkdown>{termsOfServiceText}</ReactMarkdown>
      </ContentWrapper>
    </>
  );

  const privacy = (
    <>
      <ModalHeader title="Privacy Policy" onBack={() => setMode('approve')} />
      <ContentWrapper>
        <ReactMarkdown>{privacyPolicyText}</ReactMarkdown>
      </ContentWrapper>
    </>
  );

  const Content = {
    approve,
    terms,
    privacy,
  };

  return <TutorialContent>{Content[mode]}</TutorialContent>;
};
