import React, { FC } from 'react';

import { Switcher } from '../Switcher';

import { ThemeSwitcherProps, ThemesList } from './types';

import { useTheme } from '.';

export const ThemeSwitcher: FC<ThemeSwitcherProps> = ({ setTheme }) => {
  const theme = useTheme();

  return (
    <Switcher
      items={ThemesList}
      onChange={setTheme}
      selected={ThemesList.indexOf(theme.name)}
    />
  );
};
