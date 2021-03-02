import React from 'react';

import { SocialButtons } from '..';

export default {
  title: 'SocialButtons',
  component: SocialButtons,
};

const noop = () => {};

export const Default = () => <SocialButtons onItemSelect={noop} />;

export const SelectedIcons = () => (
  <SocialButtons
    buttons={['twitter', 'facebook', 'google']}
    onItemSelect={noop}
  />
);
