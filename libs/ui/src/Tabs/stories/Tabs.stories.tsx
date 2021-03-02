import React from 'react';
import { boolean, select, optionsKnob, number } from '@storybook/addon-knobs';
import { action } from '@storybook/addon-actions';

import { Tabs } from '../Tabs';
import { TabsProps } from '../types';

import { Emoji } from '../../Emoji';
import { EmojiKeys } from '../../Emoji/types';
import { emojiList } from '../../Emoji/stories/data';
import { FontSizeList } from '../../Theme/types';
import { IconButton } from '../../IconButton';

export default {
  title: 'Tabs',
  component: Tabs,
};

export const Empty = () => <Tabs tabs={[]} />;

export const Single = () => <Tabs tabs={[{ title: 'Tab 1' }]} />;

const StoryTabs = (props: Omit<TabsProps, 'tabs'>) => {
  const tabs: EmojiKeys[] = ['MoneyMouth', 'PoliceCarLight', 'Seedling'];
  return (
    <Tabs
      onChange={action('select')}
      {...props}
      tabs={tabs.map(t => ({
        title: t,
        content: <Emoji emoji={t} />,
      }))}
    />
  );
};

export const MultiplePointerOffset20 = () => (
  <StoryTabs pointerPosition="20%" />
);
MultiplePointerOffset20.story = { name: 'Multiple (with Pointer Offset 20%)' };

export const MultiplePointerOffset80 = () => (
  <StoryTabs pointerPosition="80%" />
);
MultiplePointerOffset80.story = { name: 'Multiple (Pointer Offset 80%)' };

export const MultipleWithoutPointer = () => <StoryTabs pointer={false} />;

export const Knobs = () => {
  const enablePre = boolean('Pre', false);
  const enableExtra = boolean('Extra', false);

  const emojiOptions = Object.fromEntries(emojiList.map(e => [e, e]));

  const selectedEmojiTabs = (optionsKnob(
    'Multi Select',
    emojiOptions,
    [emojiList[0]],
    {
      display: 'multi-select',
    },
  ) as unknown) as string[];

  const pre = enablePre ? (
    <IconButton
      icon="IoIosArrowRoundBack"
      onClick={action('On back')}
      type="transparent"
    />
  ) : null;

  const extra = enableExtra ? (
    <Emoji emoji={select('Suffix emoji name', emojiList, 'MoneyMouth')} />
  ) : null;

  const pointer = boolean('Pointer', true);
  const pointerOffset = !pointer
    ? '0'
    : number('Pointer Offset %', 50, {
        range: true,
        min: 0,
        max: 100,
        step: 5,
      });

  const fontSize = select('Title Font Size', FontSizeList, 'm');

  return (
    <Tabs
      pointer={pointer}
      pointerPosition={`${pointerOffset}%`}
      pre={pre}
      extra={extra}
      titleFontSize={fontSize}
      tabs={selectedEmojiTabs.map(t => ({
        title: t,
        content: <Emoji emoji={t as EmojiKeys} />,
      }))}
    />
  );
};
