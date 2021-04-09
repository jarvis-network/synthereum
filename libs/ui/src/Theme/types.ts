import { Theme } from '@emotion/react';
import { ReactNode } from 'react';

import { FontFace } from '../FontFace/types';

export enum ThemeName {
  light = 'light',
  dark = 'dark',
  night = 'night',
}

export type ThemeNameType = keyof typeof ThemeName;

export const ThemesList: ThemeNameType[] = ['light', 'dark', 'night'];

export type FontSizeType = 'xxs' | 'xs' | 's' | 'm' | 'l' | 'xl' | 'xxl';

export const FontSizeList: FontSizeType[] = [
  'xxs',
  'xs',
  's',
  'm',
  'l',
  'xl',
  'xxl',
];

declare module '@emotion/react' {
  export interface Theme {
    sizes: {
      row: string;
    };
    rwd: {
      // the idea here is to allow to be as flexible as possible, but we still need to
      // enforce something because ui package uses that too
      // so we allow to define as many breakpoints as one wants to (some
      // mapping may be build upon that if needed, like: mobile, tablet, laptop,
      // desktop), but we still need a basic information at which point breakpoints
      // are "mobile" (non-desktop)
      breakpoints: number[]; // ie: [768, 1200], which means: 0-768, 769-1200, 1201-∞
      desktopIndex: number;
      // ^ ie: 2, which means 0-768 and 769-1200 should be considered mobile
    };
    common: {
      primary: string; // $primary-color
      primary20: string;
      secondary: string; // $dark-color
      secondary20: string;
      success: string; // $success-color
      danger: string; // $danger-color
      warning: string;
      disabled: string; // $disabled-color
      white: string; // $white
      black: string;
    };
    name: ThemeNameType;
    text: {
      primary: string; // colors.font.active, $primary-text-color
      secondary: string; // colors.font.inactive, $secondary-text-color
      medium: string;
      inverted: string; // $primary-text-color-inverted
      invalid: string;
    };
    background: {
      primary: string; // colors.fill, $primary-background
      secondary: string; // $secondary-background
      medium: string;
      inverted: string;
      disabled: string;
    };
    border: {
      primary: string; // $border-color
      secondary: string; // colors.border, $border-color-100
      inverted: string;
      panel: string;
      invalid: string;
    };
    gray: {
      gray100: string; // $gray-100
      gray200: string; // $gray-200
      gray300: string; // $gray-300
      gray400: string; // $gray-400
    };
    font: {
      family: FontFace;
      sizes: {
        xxs: string;
        xs: string;
        s: string;
        m: string;
        l: string;
        xl: string;
        xxl: string;
        xxxl: string;
      };
    };
    shadow: {
      base: string; // $base-shadow
      small: string;
      dark: string; // $dark-shadow
    };
    option: {
      background: string; // $option-bg-color
    };
    tooltip: {
      background: string;
      secondaryBackground: string;
      text: string;
    };
    scroll: {
      background: string;
      thumb: string;
    };
    borderRadius: {
      xxs: string;
      xs: string;
      s: string;
      m: string;
      l: string;
    };
  }
}

export interface ThemeProviderProps {
  theme?: ThemeNameType;
  custom?: DeepPartial<Theme>;
  children: ReactNode;
}

export interface ThemeSwitcherProps {
  setTheme: (theme: ThemeNameType) => void;
}

export type { Theme as ThemeConfig };
