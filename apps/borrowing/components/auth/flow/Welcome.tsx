import React from 'react';

import { Button, styled } from '@jarvis-network/ui';

import {
  TutorialContent,
  Img,
  BigP,
  P,
  ImgContainer,
} from '@/components/auth/flow/ModalComponents';
import { PageProps } from '@/components/auth/flow/types';

const CustomButton = styled(Button)`
  font-size: 20px;
  width: 202px;
  height: 60px;
  margin: 25px auto auto;
  text-align: center;
`;

export const Welcome: React.FC<PageProps> = ({ children, onNext }) => {
  return (
    <TutorialContent>
      <ImgContainer>
        <Img src="/images/welcome-statue.svg" alt="" />
      </ImgContainer>
      <BigP>
        Welcome to <b>Jarvis Minter</b>!
      </BigP>
      <P>
        Our protocol provides you with the ability
        <br />
        To self-mint any jAssets by supplying any token as collateral.
      </P>
      <CustomButton type="success" onClick={onNext}>
        SIGN IN
      </CustomButton>
    </TutorialContent>
  );
};
