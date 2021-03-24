import React from 'react';

import { noop } from '../../common/utils';

import { SocialButtons } from '..';

export default {
  title: 'SocialButtons',
  component: SocialButtons,
};

export const Default = () => <SocialButtons onItemSelect={noop} />;

export const SelectedIcons = () => (
  <SocialButtons
    buttons={['twitter', 'facebook', 'google']}
    onItemSelect={noop}
  />
);
