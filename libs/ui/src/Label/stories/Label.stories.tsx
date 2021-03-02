import React from 'react';
import { text } from '@storybook/addon-knobs';

import { ThemeProvider } from '../../Theme';

import { Label } from '..';

export default {
  title: 'Label',
  component: Label,
};

export const Default = () => (
  <ThemeProvider>
    <Label>Label</Label>
  </ThemeProvider>
);

export const Knobs = () => (
  <ThemeProvider>
    <Label>{text('Text', 'Label')}</Label>
  </ThemeProvider>
);
