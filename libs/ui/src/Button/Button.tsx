import React from 'react';

import { AllButtonProps } from './types';
import { LinkButton, StandardButton } from './variants';

export const Button: React.FC<AllButtonProps> = ({ href, ...props }) =>
  href ? <LinkButton href={href} {...props} /> : <StandardButton {...props} />;
