import React, { useState } from 'react';

import { select } from '@storybook/addon-knobs';

import { ThemeConfig, ThemeNameType, ThemesList } from '../types';

import { styled, ThemeProvider, ThemeSwitcher } from '..';

import { colorList } from './data';

export default {
  title: 'common/Theme',
  component: ThemeProvider,
};

const Content = styled.div`
  border: 10px solid ${props => props.theme.border.secondary};
  background-color: ${props => props.theme.background.primary};
  color: ${props => props.theme.text.primary};
  padding: 15px;

  .primary {
    color: ${props => props.theme.text.primary};
  }
  .medium {
    color: ${props => props.theme.text.medium};
  }
  .secondary {
    color: ${props => props.theme.text.secondary};
  }
`;

export const LightTheme = () => (
  <ThemeProvider theme="light">
    <Content>
      <p>
        “Live as if you were to die tomorrow. Learn as if you were to live
        forever.”
      </p>
      <p>― Mahatma Gandhi</p>
    </Content>
  </ThemeProvider>
);

export const DarkTheme = () => (
  <ThemeProvider theme="dark">
    <Content>
      <p>
        “Darkness cannot drive out darkness: only light can do that. Hate cannot
        drive out hate: only love can do that.”
      </p>
      <p>
        ― Martin Luther King Jr., A Testament of Hope: The Essential Writings
        and Speeches
      </p>
    </Content>
  </ThemeProvider>
);

export const NightTheme = () => (
  <ThemeProvider theme="night">
    <Content>
      <p>“Without music, life would be a mistake.”</p>
      <p>― Friedrich Nietzsche, Twilight of the Idols</p>
    </Content>
  </ThemeProvider>
);

export const ThemeSwitch = () => {
  const [theme, setTheme] = useState<ThemeNameType>('light');

  return (
    <ThemeProvider theme={theme}>
      <Content>
        <ThemeSwitcher setTheme={setTheme} />
        <p>“Without music, life would be a mistake.”</p>
        <p>― Friedrich Nietzsche, Twilight of the Idols</p>
      </Content>
    </ThemeProvider>
  );
};

function selectColor(name: string) {
  const res = select(name, colorList, '');
  return res === '' ? undefined : res;
}

export const Customization = () => {
  const theme = select('Theme', ThemesList, ThemesList[0]);
  const fill = selectColor('Fill color');
  const border = selectColor('Border color');
  const inactive = selectColor('Font inactive');
  const active = selectColor('Font active');

  // Setting a property value to `undefined` in the customization object will
  // indicate that the default value should be kept. Check the `selectColor`
  // function above, which replaces empty strings with `undefined` in order to
  // show case this behavior.

  const themeCustomize: DeepPartial<ThemeConfig> = {
    background: {
      primary: fill,
    },
    border: {
      secondary: border,
    },
    text: {
      primary: active,
      secondary: inactive,
    },
  };

  return (
    <ThemeProvider theme={theme} custom={themeCustomize}>
      <Content>
        <p>“Without music, life would be a mistake.”</p>
        <p>― Friedrich Nietzsche, Twilight of the Idols</p>

        <hr />

        <p className="primary">Primary text</p>
        <p className="medium">Medium text</p>
        <p className="secondary">Secondary text</p>
      </Content>
    </ThemeProvider>
  );
};
