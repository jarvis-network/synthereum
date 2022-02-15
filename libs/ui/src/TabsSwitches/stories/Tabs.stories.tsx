import React from 'react';
import { boolean, select, optionsKnob, number } from '@storybook/addon-knobs';
import { action } from '@storybook/addon-actions';

import { SwitchTabs } from '../Tabs';
import { TabsProps } from '../types';

import { Emoji } from '../../Emoji';
import { EmojiKeys } from '../../Emoji/types';
import { emojiList } from '../../Emoji/stories/data';
import { FontSizeList } from '../../Theme/types';
import { IconButton } from '../../IconButton';

export default {
  title: 'Switch Tabs',
  component: SwitchTabs,
};

const StoryTabs = (props: Omit<TabsProps, 'tabs'>) => {
  const tabs: EmojiKeys[] = ['MoneyMouth', 'PoliceCarLight', 'Seedling'];
  return (
    <SwitchTabs
      onChange={action('select')}
      {...props}
      tabs={tabs.map(t => ({
        title: t,
        content: <Emoji emoji={t} />,
      }))}
    />
  );
};

export const MultiplePointerOffset20 = () => <StoryTabs />;
MultiplePointerOffset20.story = { name: 'Tabs' };

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
  const layout = select('Layout', ['TOP-BOTTOM', 'BOTTOM-TOP'], 'TOP-BOTTOM');

  return (
    <SwitchTabs
      pointer={pointer}
      pointerPosition={`${pointerOffset}%`}
      pre={pre}
      extra={extra}
      titleFontSize={fontSize}
      layout={layout}
      tabs={selectedEmojiTabs.map(t => ({
        title: t,
        content: <Emoji emoji={t as EmojiKeys} />,
      }))}
    />
  );
};
