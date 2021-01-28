import React from 'react';

import { Icon } from '@jarvis-network/ui';

import {
  TutorialContent,
  Img,
  BigP,
  P,
  IconButton,
  ModalFooter,
  ImgContainer,
} from '@/components/auth/flow/ModalComponents';
import { PageProps } from '@/components/auth/flow/types';

export const Welcome: React.FC<PageProps> = ({ children, onNext }) => {
  return (
    <TutorialContent>
      <ImgContainer>
        <Img src="/images/welcome-statue.svg" alt="" />
      </ImgContainer>
      <BigP>
        Hello <b>stranger</b>!
      </BigP>
      <P>
        Jarvis is not a broker. Nor an exchange. It is a peer-to-contract
        trading platform to open leveraged position on several financial
        markets.
      </P>
      <P>
        Your counterpart is a smart contract holding the funds of other users,
        who are providing liquidity to Jarvis.
      </P>
      <ModalFooter>
        <IconButton onClick={onNext}>
          <Icon icon="BsArrowRight" />
        </IconButton>
      </ModalFooter>
    </TutorialContent>
  );
};
