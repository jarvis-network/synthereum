import React from 'react';

import { AllButtonProps } from './types';
import { LinkButton, StandardButton } from './variants';

export const Button: React.FC<AllButtonProps> = ({ to, ...props }) =>
  to ? <LinkButton to={to} {...props} /> : <StandardButton {...props} />;
