import React from 'react';
import { select } from '@storybook/addon-knobs';

import { Flag } from '..';

export default {
  title: 'Flag',
  component: Flag,
};

export const Default = () => <Flag flag="jCHF" />;

export const Knobs = () => {
  const flag = select('Flag', ['USDC', 'jEUR', 'jCHF', 'jGBP', 'jXAU'], 'USDC');
  const size = select('Size', ['small', 'medium', 'big'], 'medium');

  return <Flag flag={flag} size={size} />;
};
