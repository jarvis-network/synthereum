import { action } from '@storybook/addon-actions';

import stories from './ButtonStories';

import { Button } from '..';

export default {
  title: 'Button/StandardButton',
  component: Button,
};

const {
  Default,
  SuccessButton,
  InvertedSuccessButton,
  PrimaryButton,
  InvertedPrimaryButton,
  DarkButton,
  InvertedDarkButton,
  DangerButton,
  InvertedDangerButton,
  DisabledButton,
  TransparentButton,
  InvertedTransparentButton,
  RoundedButton,
  Knobs,
} = stories({
  onClick: action('clicked'),
});

export {
  Default,
  SuccessButton,
  InvertedSuccessButton,
  PrimaryButton,
  InvertedPrimaryButton,
  DarkButton,
  InvertedDarkButton,
  DangerButton,
  InvertedDangerButton,
  DisabledButton,
  TransparentButton,
  InvertedTransparentButton,
  RoundedButton,
  Knobs,
};
