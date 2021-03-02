import React from 'react';

import { ActionButtonProps } from '../types';

import { CardButton } from '../../CardButton';

export const ActionButton: React.FC<ActionButtonProps> = ({
  title,
  onClick,
  customButtonRender: CustomButtonRender,
  icon,
  ...props
}) =>
  CustomButtonRender ? (
    <CustomButtonRender />
  ) : (
    <CardButton
      {...props}
      key={title}
      title={title}
      onClick={onClick}
      icon={icon}
    />
  );
