import React from 'react';
import { ThemeProvider } from '@jarvis-network/ui';

import { useReduxSelector } from '@/state/useReduxSelector';

const AppThemeProvider = ({ children }) => {
  const theme = useReduxSelector(state => state.theme);

  return <ThemeProvider theme={theme}>{children}</ThemeProvider>;
};

export default AppThemeProvider;
