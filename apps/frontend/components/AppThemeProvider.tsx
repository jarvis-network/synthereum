import React from 'react';
import { ThemeProvider } from '@jarvis-network/ui';
import { useAddThemeClassNameInBody } from '@jarvis-network/app-toolkit';

import { useReduxSelector } from '@/state/useReduxSelector';

export const AppThemeProvider: React.FC = ({ children }) => {
  const theme = useReduxSelector(state => state.theme);

  useAddThemeClassNameInBody(theme);

  return <ThemeProvider theme={theme}>{children}</ThemeProvider>;
};
