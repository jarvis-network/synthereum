import React, { useState } from 'react';

import { styled } from '../Theme';
import { Button } from '../Button';

const Container = styled.div`
  z-index: 100;
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  box-sizing: border-box;
  border: 1px solid ${props => props.theme.border.primary};
  border-radius: ${props => props.theme.borderRadius.s};
  background: ${props => props.theme.background.primary};
`;

const Inner = styled.div`
  max-width: 1100px;
  margin: auto;
  padding: 20px;
  display: flex;
  align-items: center;

  @media screen and (max-width: ${props =>
      props.theme.rwd.breakpoints[props.theme.rwd.desktopIndex - 1]}px) {
    flex-direction: column;
  }
`;

const Text = styled.div`
  flex: 1;
  padding-right: 20px;
  font-size: 16px;
  color: ${props => props.theme.text.primary};

  @media screen and (max-width: ${props =>
      props.theme.rwd.breakpoints[props.theme.rwd.desktopIndex - 1]}px) {
    padding: 0 0 20px 0;
  }
`;

const CustomButton = styled(Button)`
  text-transform: uppercase;
  font-weight: 300;
  height: 40px;
`;

export interface Props {
  text: React.ReactNode;
  buttonText: React.ReactNode;
  store: string;
}

export const AcceptBox = ({ text, buttonText, store }: Props) => {
  const [accepted, setAccepted] = useState(
    Boolean(localStorage.getItem(store)),
  );

  if (accepted) {
    return null;
  }

  const onClick = () => {
    localStorage.setItem(store, '1');
    setAccepted(true);
  };

  return (
    <Container>
      <Inner>
        <Text>{text}</Text>
        <CustomButton type="transparent" inverted size="m" onClick={onClick}>
          {buttonText}
        </CustomButton>
      </Inner>
    </Container>
  );
};
