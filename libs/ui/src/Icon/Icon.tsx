import React, { FC, CSSProperties } from 'react';

import { styled } from '../Theme';

import * as icons from './icons';

export { icons };

export type IconKeys = keyof typeof icons;

interface IconProps {
  icon: IconKeys;
  className?: string;
  style?: CSSProperties;
  onClick?: React.DOMAttributes<HTMLElement>['onClick'];
}

export const IconContainer = styled.i`
  display: inline-flex;
  align-items: center;
  justify-content: center;
`;

export const Icon: FC<IconProps> = ({ icon, className, style, onClick }) => {
  const IconComponent = icons[icon];

  return (
    <IconContainer className={className} style={style} onClick={onClick}>
      <IconComponent />
    </IconContainer>
  );
};
