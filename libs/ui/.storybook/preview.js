import React from 'react';

import { MemoryRouter } from 'react-router-dom';
import { select, boolean } from '@storybook/addon-knobs';
import { themesList } from '../src/Theme/stories/data';

import { ThemedStory } from '../src/common/ThemedStory';
import { addons } from '@storybook/addons';

// addDecorator(StoryRouter());
addons.setConfig({
  showRoots: false,
  backgrounds: [{ name: 'container', value: '#f1f1f1' }],
});

const themeDecoratorIgnore = [
  'common/Theme',
  'Background',
  'accountdropdown--interactive',
];

export const decorators = [
  (Story, info) => {
    if (
      themeDecoratorIgnore.includes(info.kind) ||
      themeDecoratorIgnore.includes(info.id)
    ) {
      return <Story {...info} />;
    }

    return (
      <ThemedStory>
        <MemoryRouter>
          <Story {...info} />
        </MemoryRouter>
      </ThemedStory>
    );
  },
];
// addDecorator(decorators);
