import React from 'react';
import { action } from '@storybook/addon-actions';
import { select, boolean } from '@storybook/addon-knobs';

import { iconList } from '../../Icon/stories/data';

import { IconButton } from '..';

export default {
  title: 'Button/IconButton',
  component: IconButton,
};

export const Default = () => (
  <IconButton onClick={action('clicked')} icon="BsDownload" />
);

export const Inline = () => (
  <div>
    <div>
      The text:
      <IconButton onClick={action('clicked')} icon="BsDownload" inline />
    </div>
    <div>
      <IconButton onClick={action('clicked')} icon="BsDownload" inline />
      The text:
    </div>
  </div>
);

export const Knobs = () => (
  <IconButton
    onClick={action('clicked')}
    icon={select('Name', iconList, 'BsDownload')}
    size={select('Size', ['xxs', 'xs', 's', 'm', 'l', 'xl', 'xxl'], 'xl')}
    inline={boolean('Inline', false)}
  />
);
