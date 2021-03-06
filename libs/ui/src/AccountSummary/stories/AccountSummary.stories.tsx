import React, { useState } from 'react';

import { select, text } from '@storybook/addon-knobs';
import { action } from '@storybook/addon-actions';

import { ThemeProvider } from '../../Theme';
import { ThemeNameType } from '../../Theme/types';

import { ColoredBorderPanel } from '../../ColoredBorderPanel';

import { AccountSummary } from '..';
import { noop } from '../../common/utils';

export default {
  title: 'Account/AccountSummary',
  component: AccountSummary,
};

const menu = [
  {
    name: 'Account',
    onClick: () => action('Clicked Account'),
  },
  {
    name: 'Contact',
    onClick: () => action('Clicked Contact'),
  },
];

export const Default = () => <AccountSummary />;

export const WithAuth = () => (
  <AccountSummary wallet="aldsajd" name="john doe" />
);

export const WithMode = () => (
  <AccountSummary name="johny" wallet="0x235c..fe47" mode="real" />
);

export const WithMenu = () => (
  <AccountSummary name="johny" wallet="0x235c..fe47" mode="demo" menu={menu} />
);

export const WithThemeSwitcher = () => (
  <AccountSummary
    name="johny"
    wallet="0x235c..fe47"
    mode="demo"
    menu={menu}
    onThemeChange={noop}
  />
);

export const WithThemeSwitcherContentOnTop = () => (
  <ColoredBorderPanel>
    <p>Interactive demo:</p>
    <AccountSummary
      name="johny"
      wallet="0x235c..fe47"
      mode="demo"
      menu={menu}
      contentOnTop
      onThemeChange={noop}
    />
  </ColoredBorderPanel>
);

export const Interactive = () => {
  const name = text('Name', 'johnny');
  const wallet = text('Wallet', '0x235c..fe47');
  const mode = select('Mode', ['real', 'demo'], 'real');

  const [isLoggedIn, setStateLoggedIn] = useState(true);
  const [theme, setTheme] = useState<ThemeNameType>('light');

  const setLoggedIn = (state: boolean) => {
    setTimeout(() => {
      setStateLoggedIn(state);
    }, 500);
  };

  return (
    <ThemeProvider theme={theme}>
      <ColoredBorderPanel>
        <p>Interactive demo:</p>
        <AccountSummary
          name={isLoggedIn ? name : undefined}
          wallet={isLoggedIn ? wallet : undefined}
          mode={isLoggedIn ? mode : undefined}
          menu={menu}
          onThemeChange={setTheme}
          onLogin={() => setLoggedIn(true)}
          onLogout={() => setLoggedIn(false)}
          onHelp={action('Help requested')}
        />
      </ColoredBorderPanel>
    </ThemeProvider>
  );
};
