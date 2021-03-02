import React, { FC, ReactNode } from 'react';

import { styled } from '../Theme';
import { Button } from '../Button';
import { AllButtonProps } from '../Button/types';
import { Icon } from '../Icon';
import { IconKeys } from '../Icon/Icon';

export interface IconButtonProps extends AllButtonProps {
  icon: IconKeys;
  inline?: boolean;
}

interface IconButtonContainerProps extends AllButtonProps {
  children: ReactNode;
}

enum Padding {
  xxs = 4,
  xs = 5,
  s = 6,
  m = 7,
  l = 8,
  xl = 9,
  xxl = 10,
  xxxl = 11,
}

enum Size {
  xxs = 25,
  xs = 30,
  s = 35,
  m = 40,
  l = 45,
  xl = 50,
  xxl = 55,
  xxxl = 60,
}

const IconButtonContainer: FC<IconButtonContainerProps> = ({
  children,
  ...options
}) => {
  const { size = 'xl' } = options;

  const Component = styled(Button)`
    display: flex;
    font-size: ${props => props.theme.font.sizes[size]};
    padding: ${Padding[size]}px;
    height: ${Size[size]}px;
    width: ${Size[size]}px;
    border-radius: ${props => props.theme.borderRadius.xs};
  `;

  return <Component {...options}>{children}</Component>;
};

const InlineIconButtonContainer: FC<IconButtonContainerProps> = ({
  children,
  type = 'transparent',
  ...options
}) => {
  const { size = 'l' } = options;

  const Component = styled(Button)`
    display: inline-flex;
    vertical-align: bottom;
    font-size: ${props => props.theme.font.sizes[size]};
    height: ${Size[size] / 2}px;
    width: ${Size[size] / 2 + Padding[size] / 2}px;
    padding: 0;
  `;

  return (
    <Component {...options} type={type}>
      {children}
    </Component>
  );
};

export const IconButton: React.FC<IconButtonProps> = ({
  icon,
  className,
  inline,
  ...props
}) => {
  const Component = inline ? InlineIconButtonContainer : IconButtonContainer;

  return (
    <Component className={className || ''} {...props}>
      <Icon icon={icon!} />
    </Component>
  );
};
