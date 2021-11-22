import React, { FC, CSSProperties } from 'react';

import { styled } from '../Theme';

import * as icons from './icons';

export type IconKeys = keyof typeof icons;

export interface IconProps {
  icon: IconKeys;
  className?: string;
  style?: CSSProperties;
}

export const IconContainer = styled.i`
  display: inline-flex;
  align-items: center;
  justify-content: center;
`;

export const Icon: FC<IconProps> = ({ icon, className, style = {} }) => {
  const IconComponent = icons[icon];

  return (
    <IconContainer className={className} style={style}>
      <IconComponent />
    </IconContainer>
  );
};
