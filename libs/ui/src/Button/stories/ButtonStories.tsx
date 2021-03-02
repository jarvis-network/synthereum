import React from 'react';
import { boolean, select, text } from '@storybook/addon-knobs';

import { buttonTypes } from '../types';

import { Button } from '..';

interface Props {
  to?: string;
  onClick?: () => void;
}

export default (props: Props) => ({
  Default: () => <Button {...props}>Link button</Button>,
  SuccessButton: () => (
    <Button type="success" {...props}>
      Success button
    </Button>
  ),
  InvertedSuccessButton: () => (
    <Button type="success" inverted {...props}>
      Success button
    </Button>
  ),
  PrimaryButton: () => (
    <Button type="primary" {...props}>
      Success button
    </Button>
  ),
  InvertedPrimaryButton: () => (
    <Button type="primary" inverted {...props}>
      Success button
    </Button>
  ),
  DarkButton: () => (
    <Button type="dark" {...props}>
      Dark button
    </Button>
  ),
  InvertedDarkButton: () => (
    <Button type="dark" inverted {...props}>
      Dark button
    </Button>
  ),
  DangerButton: () => (
    <Button type="danger" {...props}>
      Danger button
    </Button>
  ),
  InvertedDangerButton: () => (
    <Button type="danger" inverted {...props}>
      Danger button
    </Button>
  ),
  RoundedButton: () => (
    <Button rounded {...props}>
      Rounded button
    </Button>
  ),
  DisabledButton: () => (
    <Button disabled {...props}>
      Disabled button
    </Button>
  ),
  TransparentButton: () => (
    <Button type="transparent" {...props}>
      Transparent button
    </Button>
  ),
  InvertedTransparentButton: () => (
    <Button inverted type="transparent" {...props}>
      Inverted transparent button
    </Button>
  ),
  Knobs: () => (
    <Button
      type={select('Type', buttonTypes, undefined)}
      disabled={boolean('Disabled', false)}
      rounded={boolean('Rounded', false)}
      inverted={boolean('Inverted', false)}
      size={select('Size', ['xxs', 'xs', 's', 'm', 'l', 'xl', 'xxl'], 'xl')}
      {...props}
    >
      {text('Text', 'Knobs')}
    </Button>
  ),
});
