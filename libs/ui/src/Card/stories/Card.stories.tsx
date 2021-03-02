import React from 'react';
import { action } from '@storybook/addon-actions';

import { Card, CardTabs } from '..';

export default {
  title: 'Card',
  component: Card,
};

export const Default = () => (
  <Card title="Card title">I am a Card content</Card>
);

export const WithBack = () => (
  <Card title="Card title" onBack={action('back')}>
    I am a Card content
  </Card>
);

export const Tabs = () => (
  <CardTabs
    tabs={[
      {
        title: 'Tab 1',
        content: <div>Tab 1 content</div>,
      },
      {
        title: 'Tab 2',
        content: <div>Tab 2 content</div>,
      },
    ]}
  />
);
