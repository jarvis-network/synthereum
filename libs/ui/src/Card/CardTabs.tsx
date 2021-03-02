import React, { FC } from 'react';

import { Tabs, TabsProps } from '../Tabs';
import { styled } from '../Theme';

export interface CardTabsProps extends TabsProps {}

const Container = styled.div`
  position: relative;
  box-shadow: ${props => props.theme.shadow.base};
  border-radius: ${props => props.theme.borderRadius.m};
  height: 100%;
`;

export const CardTabs: FC<CardTabsProps> = props => (
  <Container>
    <Tabs {...props} />
  </Container>
);
