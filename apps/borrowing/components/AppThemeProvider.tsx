import React from 'react';
import { ThemeProvider } from '@jarvis-network/ui';
import { useReduxSelector } from '@/state/useReduxSelector';

export const AppThemeProvider: React.FC = ({ children }) => {
  const theme = useReduxSelector(state => state.theme);

  return <ThemeProvider theme={theme}>{children}</ThemeProvider>;
};
