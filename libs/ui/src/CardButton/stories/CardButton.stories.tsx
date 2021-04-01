import React from 'react';
import { radios, select, text } from '@storybook/addon-knobs';

import { Emoji } from '../../Emoji';
import { emojiList } from '../../Emoji/stories/data';
import { iconList } from '../../Icon/stories/data';

import { CardButton } from '..';

export default {
  title: 'Button/CardButton',
  component: CardButton,
};

const props = {
  title: 'Title',
};

export const Default = () => (
  <CardButton
    {...props}
    subtitle="Subtitle"
    leftButtonIcon="BsDownload"
    arrow
  />
);

export const Title = () => <CardButton {...props} />;

export const Subtitle = () => <CardButton {...props} subtitle="Subtitle" />;

export const LeftIcon = () => (
  <CardButton {...props} leftButtonIcon="BsDownload" />
);

export const Arrow = () => <CardButton {...props} arrow />;

export const CustomLeftSection = () => (
  <CardButton {...props} leftSection={<Emoji emoji="MoneyMouth" />} />
);

export const CustomRightSection = () => (
  <CardButton {...props} rightSection={<Emoji emoji="MoneyMouth" />} />
);

export const Knobs = () => {
  const knobsProps: any = {};
  const leftSection = radios(
    'Left section',
    {
      None: null,
      'Icon Button': 'iconButton',
      'Custom Section': 'custom',
    },
    'iconButton',
  );

  const rightSection = radios(
    'Right section',
    {
      None: null,
      Arrow: 'arrow',
      'Custom Section': 'custom',
    },
    'arrow',
  );

  switch (leftSection) {
    case 'iconButton':
      knobsProps.leftButtonIcon = select('Icon Name', iconList, 'BsDownload');
      break;
    case 'custom':
      knobsProps.leftSection = (
        <Emoji
          emoji={select('Left section emoji name', emojiList, 'MoneyMouth')}
        />
      );
      break;
    default:
      break;
  }

  switch (rightSection) {
    case 'arrow':
      knobsProps.arrow = true;
      break;
    case 'custom':
      knobsProps.rightSection = (
        <Emoji
          emoji={select('Right section emoji name', emojiList, 'MoneyMouth')}
        />
      );
      break;
    default:
      break;
  }

  return (
    <CardButton
      title={text('Title', 'Title')}
      subtitle={text('Subtitle', 'Subtitle')}
      {...knobsProps}
    />
  );
};
