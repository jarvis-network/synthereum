import React, { useState } from 'react';

import { ThemeProvider } from '../../Theme';
import { ThemeNameType } from '../../Theme/types';

import { AccountDropdown } from '..';

export default {
  title: 'Account/AccountDropdown',
  component: AccountDropdown,
};

const noop = () => {};

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
    // eslint-disable-next-line no-alert
    onClick: () => alert('Clicked Account'),
  },
  {
    name: 'Contact',
    // eslint-disable-next-line no-alert
    onClick: () => alert('Clicked Contact'),
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
