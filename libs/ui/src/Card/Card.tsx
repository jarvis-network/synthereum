import React, { FC, ReactNode } from 'react';

import { IconButton } from '../IconButton';
import { styled } from '../Theme';

import { CardTabs, CardTabsProps } from './CardTabs';

const Wrapper = styled.div`
  width: 100%;
  height: 100%;
  background: ${props => props.theme.background.primary};
  border-radius: 0 0 ${props => props.theme.borderRadius.m}
    ${props => props.theme.borderRadius.m};
`;

interface CardProps extends Omit<CardTabsProps, 'tabs'> {
  title: string;
  children: ReactNode;
  onBack?: () => void;
}

const BackIcon = styled(IconButton)`
  height: ${props => props.theme.sizes.row};
  border-radius: ${props => props.theme.borderRadius.m};
  background: ${props => props.theme.background.secondary};
`;

export const Card: FC<CardProps> = ({ title, children, onBack, ...props }) => (
  <CardTabs
    {...props}
    pre={
      onBack ? (
        <BackIcon
          onClick={onBack}
          icon="IoIosArrowRoundBack"
          type="transparent"
          size="xxl"
        />
      ) : null
    }
    tabs={[
      {
        title,
        content: <Wrapper>{children}</Wrapper>,
      },
    ]}
  />
);
