import { ThemeConfig } from '@jarvis-network/ui';
import { ThemeName } from '@jarvis-network/ui/dist/Theme/types';

interface Props {
  theme: ThemeConfig;
}

type SelectorFn = (theme: ThemeConfig) => string;
type SelectorOrValue = SelectorFn | string;

type Config = {
  [key in ThemeName]?: SelectorOrValue;
};

const getValue = (selectorOrValue: SelectorOrValue, theme: ThemeConfig) => {
  if (typeof selectorOrValue === 'string') {
    return selectorOrValue;
  }
  return selectorOrValue(theme);
};

export const themeValue = (config: Config, defaultValue?: SelectorOrValue) => ({
  theme,
}: Props) => {
  return config[theme.name]
    ? getValue(config[theme.name], theme)
    : defaultValue
    ? getValue(defaultValue, theme)
    : '';
};
