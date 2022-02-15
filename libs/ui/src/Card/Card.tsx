import React, { FC, ReactNode } from 'react';

import { Emoji } from '../Emoji';
import { EmojiKeys } from '../Emoji/types';

import { IconButton } from '../IconButton';
import { styled } from '../Theme';

import { CardTabs, CardTabsProps } from './CardTabs';

const Wrapper = styled.div`
  width: 100%;

  background: ${props => props.theme.background.primary};
  border-radius: 0 0 ${props => props.theme.borderRadius.m}
    ${props => props.theme.borderRadius.m};
`;

export interface CardProps extends Omit<CardTabsProps, 'tabs'> {
  title: string;
  children: ReactNode;
  titleBackground?: boolean;
  leftEmoji?: EmojiKeys;
  onBack?: () => void;
}

const BackIcon = styled(IconButton)`
  height: ${props => props.theme.sizes.row};
  border-radius: ${props => props.theme.borderRadius.m};
  background: ${props => props.theme.background.secondary};
`;
const CloseIcon = styled(IconButton)`
  height: ${props => props.theme.sizes.row};
  padding: 0px;
  margin-right: -12px;
`;

const MoneyEmoji = styled(Emoji)`
  height: ${props => props.theme.sizes.row};
  padding: 0px 20px;
  font-size: ${props => props.theme.font.sizes.xl};
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

export const CardAssets: FC<CardProps> = ({
  title,
  children,
  onBack,
  leftEmoji = 'MoneyBag',
  ...props
}) => (
  <CardTabs
    {...props}
    pre={<MoneyEmoji emoji={leftEmoji!} />}
    extra={
      onBack ? (
        <CloseIcon
          onClick={onBack}
          icon="IoIosClose"
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
