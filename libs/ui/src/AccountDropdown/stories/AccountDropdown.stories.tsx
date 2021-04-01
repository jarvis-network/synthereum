import React, { useState } from 'react';

import { action } from '@storybook/addon-actions';

import { ThemeProvider } from '../../Theme';
import { ThemeNameType } from '../../Theme/types';

import { AccountDropdown } from '..';
import { noop } from '../../common/utils';

export default {
  title: 'Account/AccountDropdown',
  component: AccountDropdown,
};

export const Default = () => (
  <AccountDropdown
    name="johndoe"
    wallet="0x235c..fe47"
    onLogout={noop}
    onThemeChange={noop}
  />
);

export const Short = () => (
  <AccountDropdown
    name="johndoe"
    wallet="0x235c..fe47"
    onLogout={noop}
    onThemeChange={noop}
    width="195px"
  />
);

const links = [
  {
    name: 'Account',
    onClick: () => action('Clicked Account'),
  },
  {
    name: 'Contact',
    onClick: () => action('Clicked Contact'),
  },
];

export const WithCustomLinks = () => (
  <AccountDropdown
    name="johndoe"
    wallet="0x235c..fe47"
    onLogout={noop}
    onThemeChange={noop}
    links={links}
    width="195px"
  />
);

export const Interactive = () => {
  const [isLoggedIn, setLoggedIn] = useState(true);
  const [theme, setTheme] = useState<ThemeNameType>('light');

  return (
    <ThemeProvider theme={theme}>
      {isLoggedIn && (
        <AccountDropdown
          name="johndoe"
          wallet="0x235c..fe47"
          onLogout={() => setLoggedIn(false)}
          onThemeChange={setTheme}
        />
      )}

      {!isLoggedIn && <div>Logged out</div>}
    </ThemeProvider>
  );
};
