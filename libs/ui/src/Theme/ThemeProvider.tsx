import { ThemeProvider as EmotionThemeProvider } from '@emotion/react';
import React, { FC } from 'react';

import { deepMerge } from '../common/deep-merge';

import { BodyFontFaceProvider } from '../FontFace';

import { ThemeProviderProps, ThemeConfig } from './types';
import { themesMap } from './themes';

const getThemeConfig = ({
  theme = 'light',
  custom,
}: Pick<ThemeProviderProps, 'theme' | 'custom'>): ThemeConfig => {
  const $preBuildTheme = { ...themesMap[theme] };

  if (!custom) {
    return $preBuildTheme;
  }

  return deepMerge($preBuildTheme, custom);
};

export const ThemeProvider: FC<ThemeProviderProps> = ({
  children,
  theme,
  custom,
}) => {
  const themeConfig = getThemeConfig({ theme, custom });

  return (
    <EmotionThemeProvider theme={getThemeConfig({ theme, custom })}>
      <BodyFontFaceProvider font={themeConfig.font.family}>
        {children}
      </BodyFontFaceProvider>
    </EmotionThemeProvider>
  );
};
