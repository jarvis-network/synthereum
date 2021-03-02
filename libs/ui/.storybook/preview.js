import React from 'react';
import { addParameters, addDecorator } from '@storybook/react';
import StoryRouter from 'storybook-react-router';

import { ThemedStory } from '../src/common/ThemedStory';

addDecorator(StoryRouter());
addParameters({
  backgrounds: [{ name: 'container', value: '#f1f1f1' }],
  options: {
    showRoots: true,
  },
});

const themeDecoratorIgnore = [
  'common/Theme',
  'Background',
  'accountdropdown--interactive',
];

const themeDecorator = (Story, info) => {
  if (
    themeDecoratorIgnore.includes(info.kind) ||
    themeDecoratorIgnore.includes(info.id)
  ) {
    return <Story />;
  }
  return (
    <ThemedStory>
      <Story />
    </ThemedStory>
  );
};
addDecorator(themeDecorator);
