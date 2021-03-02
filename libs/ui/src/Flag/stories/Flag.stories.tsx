import React from 'react';
import { select } from '@storybook/addon-knobs';

import { Flag } from '..';

export default {
  title: 'Flag',
  component: Flag,
};

export const Default = () => <Flag flag="chf" />;

export const Knobs = () => {
  const flag = select('Flag', ['us', 'eur', 'chf', 'gbp', 'xau'], 'us');
  const size = select('Size', ['small', 'medium', 'big'], 'medium');

  return <Flag flag={flag} size={size} />;
};
