import React from 'react';

import { MenuDropdown } from '..';

export default {
  title: 'Dropdown/MenuDropdown',
  component: MenuDropdown,
};

export const Default = () => (
  <MenuDropdown
    items={[
      {
        to: '/account',
        name: 'Account',
      },
      {
        to: '/help',
        name: 'Help',
      },
    ]}
  />
);
