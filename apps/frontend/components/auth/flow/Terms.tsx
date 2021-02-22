import React, { useState } from 'react';
import { PageProps } from '@/components/auth/flow/types';
import {
  BigP,
  Img,
  TutorialContent,
  P,
  ImgContainer,
  ChevronRight,
} from '@/components/auth/flow/ModalComponents';
import {
  Button,
  Checkbox,
  ModalContent,
  styled,
  themeValue,
} from '@jarvis-network/ui';

const TermsContainer = styled.div`
  display: flex;
  margin-top: 10px;

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
  font-size: ${props => props.theme.font.sizes.s};
  font-weight: bold;
  border-color: ${themeValue(
    { light: theme => theme.border.primary },
    theme => theme.border.secondary,
  )};
  height: 52px;
  background: none;
  color: currentColor;

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

  > :first-child {
    flex: 1;
  }
`;

const Submit = styled(Button)`
  font-size: 18px;
  :not(:disabled) {
    ${props => (props.theme.name === 'light' ? 'color: black;' : '')}
  }
`;

export const Terms: React.FC<PageProps> = ({ onNext }) => {
  const [checked, setChecked] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);

  const toggle = () => setChecked(p => !p);

  return (
    <TutorialContent>
      <ImgContainer>
        <Img src="/images/welcome-statue.svg" alt="" />
      </ImgContainer>

      <BigP>Please review the terms below before starting.</BigP>
      <P>
        No worry, they are <b>easy to read</b>!
      </P>
      <TermsContainer>
        <Btn inverted type="dark" onClick={() => setShowTerms(true)}>
          <span>Terms of service</span>
          <ChevronRight />
        </Btn>
        <Btn inverted type="dark" onClick={() => setShowPrivacy(true)}>
          <span>Privacy Policy</span>
          <ChevronRight />
        </Btn>
      </TermsContainer>

      <Footer>
        <div>
          <Checkbox checked={checked} onChange={toggle} name="acc">
            I have read and understood the terms above
          </Checkbox>
        </div>
        <Submit type="primary" disabled={!checked} onClick={onNext}>
          I agree
        </Submit>
      </Footer>

      <ModalContent
        title="Terms of a service"
        isOpened={showTerms}
        onClose={() => setShowTerms(false)}
      >
        terms
      </ModalContent>

      <ModalContent
        title="Privacy Policy"
        isOpened={showPrivacy}
        onClose={() => setShowPrivacy(false)}
      >
        terms
      </ModalContent>
    </TutorialContent>
  );
};
