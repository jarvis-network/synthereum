import { ThemeProvider as EmotionThemeProvider } from '@emotion/react';
import { ThemeProvider as MaterialUIThemeProvider } from '@material-ui/core';
import React, { FC } from 'react';

import { deepMerge } from '../common/deep-merge';

import { BodyFontFaceProvider } from '../FontFace';
import { skeletonThemesMap } from '../Skeleton/themes';

import { ThemeProviderProps, ThemeConfig } from './types';
import { themesMap } from './themes';

type ValueOf<T> = T[keyof T];

const getThemeConfig = ({
  theme = 'light',
  custom,
}: Pick<ThemeProviderProps, 'theme' | 'custom'>): {
  theme: ThemeConfig;
  skeletonTheme: ValueOf<typeof skeletonThemesMap>;
} => {
  const $preBuildTheme = { ...themesMap[theme] };

  if (!custom) {
    return { theme: $preBuildTheme, skeletonTheme: skeletonThemesMap[theme] };
  }

  return {
    theme: deepMerge($preBuildTheme, custom),
    skeletonTheme: skeletonThemesMap[theme],
  };
};

export const ThemeProvider: FC<ThemeProviderProps> = ({
  children,
  theme: themeName,
  custom,
}) => {
  const { theme, skeletonTheme } = getThemeConfig({ theme: themeName, custom });

  return (
    <MaterialUIThemeProvider theme={skeletonTheme}>
      <EmotionThemeProvider theme={theme}>
        <BodyFontFaceProvider font={theme.font.family}>
          {children}
        </BodyFontFaceProvider>
      </EmotionThemeProvider>
    </MaterialUIThemeProvider>
  );
};
