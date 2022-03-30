import React from 'react';

import { MemoryRouter } from 'react-router-dom';

import { ThemedStory } from '../src/common/ThemedStory';
import { addons } from '@storybook/addons';

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
