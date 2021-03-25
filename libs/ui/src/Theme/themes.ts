import { FontFace } from '../FontFace/types';

import { ThemeName, ThemeConfig } from './types';

export const ligthTheme: ThemeConfig = {
  name: 'light',
  sizes: {
    row: '60px',
  },
  rwd: {
    breakpoints: [1080],
    desktopIndex: 1,
  },
  common: {
    primary: '#00b0f0',
    primary20: 'rgba(128, 223, 255, 0.2)',
    secondary: '#404040',
    secondary20: 'rgba(64, 64, 64, 0.2)',
    success: '#4efa74',
    danger: 'red',
    warning: '#ffc000',
    disabled: '#f2f2f2',
    white: '#fff',
    black: '#000',
  },
  text: {
    primary: '#000',
    secondary: '#bebebe', // 26% lighten, than primary
    medium: '#7e7e7e', // something in between primary and secondary
    inverted: '#fff', // opposite to primary
    invalid: '#DC81A2',
  },
  background: {
    primary: '#fff',
    secondary: '#f1f1f1', // 5% darken, than primary
    medium: '#FAFAFA',
    inverted: '#000', // opposite to primary
    disabled: '#f5f5f5',
  },
  border: {
    primary: '#f1f1f1',
    secondary: '#fafafa', // 30% lighten, than primary
    inverted: '#0e0e0e', // opposite to primary
    panel: '#e490ae',
    invalid: '#DC81A2',
  },
  gray: {
    gray100: '#fefefe',
    gray200: '#f1f1f1',
    gray300: '#f7f7f7',
    gray400: '#7e7e7e',
  },
  font: {
    family: FontFace.KRUB,
    sizes: {
      xxs: '10px',
      xs: '12px',
      s: '14px',
      m: '16px', // default
      l: '18px',
      xl: '25px',
      xxl: '30px',
      xxxl: '36px',
    },
  },
  shadow: {
    base: '0 7px 20px 0 rgba(0, 0, 0, 0.08)',
    small: '0 0 8px 0 rgba(0, 0, 0, 0.28)',
    dark: '0 0 20px rgba(0, 0, 0, 0.28)',
  },
  option: {
    background: '#4d4d4d',
  },
  tooltip: {
    background: '#C9F1FF',
    secondaryBackground: '#E5F7FE',
    text: '#00B0F0',
  },
  scroll: {
    background: '#fff',
    thumb: '#c1c1c1',
  },
  borderRadius: {
    xxs: '3px',
    xs: '6px',
    s: '10px',
    m: '20px',
    l: '30px',
  },
};

export const darkTheme: ThemeConfig = {
  ...ligthTheme,
  name: 'dark',
  text: {
    primary: '#fff',
    secondary: 'rgb(96,96,96)',
    medium: '#7e7e7e',
    inverted: '#000',
    invalid: '#76646E',
  },
  background: {
    primary: 'rgb(41,41,41)',
    secondary: 'rgb(37,37,37)',
    medium: '#252525',
    inverted: '#dedede',
    disabled: '#262626',
  },
  border: {
    primary: '#767676',
    secondary: 'rgb(59,59,59)',
    inverted: '#898989',
    panel: '#76646e',
    invalid: '#76646E',
  },
  shadow: {
    base: '0 7px 20px 0 rgba(0, 0, 0, 0.08)',
    small: '0 7px 20px 0 rgba(0, 0, 0, 0.08)',
    dark: '0 0 20px $dark-shadow',
  },
  scroll: {
    background: '#292929',
    thumb: 'rgba(0,0,0,0.3)',
  },
};

export const nightTheme: ThemeConfig = {
  ...ligthTheme,
  name: 'night',
  text: {
    primary: '#fff',
    secondary: 'rgb(99,117,141)',
    medium: '#63758d',
    inverted: '#000',
    invalid: '#765C93',
  },
  background: {
    primary: 'rgb(46,53,65)',
    secondary: 'rgb(33,42,52)',
    medium: '#212A34',
    inverted: '#e4dcd3',
    disabled: '#262d38',
  },
  border: {
    primary: '#65728a',
    secondary: 'rgb(52,59,71)',
    inverted: '#9a8d75',
    panel: '#765c93',
    invalid: '#765C93',
  },
  shadow: {
    base: '0 7px 20px 0 rgba(0, 0, 0, 0.08)',
    small: '0 7px 20px 0 rgba(0, 0, 0, 0.08)',
    dark: '0 0 20px $dark-shadow',
  },
  scroll: {
    background: '#2e3541',
    thumb: 'rgba(0,0,0,0.3)',
  },
};

export const themesMap = {
  [ThemeName.light]: ligthTheme,
  [ThemeName.dark]: darkTheme,
  [ThemeName.night]: nightTheme,
} as const;
