import React from 'react';

import { styled } from '../../Theme';

import { AccountButton } from '..';

export default {
  title: 'Account/AccountButton',
  component: AccountButton,
};

export const Default = () => (
  <AccountButton name="johndoe" wallet="0x235c..fe47" />
);

export const Demo = () => (
  <AccountButton name="johndoe" wallet="0x235c..fe47" />
);

export const WithImage = () => (
  <AccountButton
    name="johndoe"
    wallet="0x235c..fe47"
    image="https://is.gd/avataravatar"
  />
);

const CustomButton = styled(AccountButton)`
  width: 300px;
`;

export const WithCustomStyles = () => (
  <>
    This has fixed width:
    <CustomButton
      name="johndoe"
      wallet="0x235c..fe47"
      image="https://is.gd/avataravatar"
    />
  </>
);

export const WithoutName = () => (
  <>
    <CustomButton
      name=""
      wallet="0x235c..fe47"
      image="https://is.gd/avataravatar"
    />
  </>
);
