import { Theme } from '@emotion/react';

import { ThemeName } from './types';

export interface ThemeValueProps {
  theme: Theme;
}

type SelectorFn = (theme: Theme) => string;
type SelectorOrValue = SelectorFn | string;

type Config = {
  [key in ThemeName]?: SelectorOrValue;
};

const getValue = (selectorOrValue: SelectorOrValue, theme: Theme) => {
  if (typeof selectorOrValue === 'string') {
    return selectorOrValue;
  }
  return selectorOrValue(theme);
};

/**
 * Helper to define different styles based on current theme, which can't be simply
 * implemented by just using theme object. Results in cleaner code when you want to
 * use primary background on light theme and secondary on dark/night themes.
 *
 * All values can be simple string or a selector function from theme object
 *
 * @param config - object with non-default cases, where key is theme name
 * @param defaultValue - default value to use when current theme is not specified in
 * config
 *
 * @example in `styled`:
 * styled.div`
 *   color: ${themeValue({ light: "black" }, "white")};
 *   // ^ black on light theme, white on every other theme
 *   background: ${themeValue({ dark: theme => theme.background.primary }, theme => theme.background.secondary)}
 *   // primary background from theme object on dark theme, secondary on other themes
 * `
 */
export const themeValue = (config: Config, defaultValue?: SelectorOrValue) => ({
  theme,
}: ThemeValueProps): string =>
  config[theme.name]
    ? getValue(config[theme.name]!, theme)
    : defaultValue
    ? getValue(defaultValue, theme)
    : '';
