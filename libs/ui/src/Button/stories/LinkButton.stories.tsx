import { Button } from '..';

import stories from './ButtonStories';

export default {
  title: 'Button/LinkButton',
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
  to: '/route',
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
