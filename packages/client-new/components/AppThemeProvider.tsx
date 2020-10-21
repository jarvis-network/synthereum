import React from 'react';
import { useSelector } from 'react-redux';
import { ThemeProvider } from '@jarvis-network/ui';

import { State } from '@/state/initialState';

const AppThemeProvider = ({ children }) => {
  const theme = useSelector((state: State) => state.theme);

  return <ThemeProvider theme={theme}>{children}</ThemeProvider>;
};

export default AppThemeProvider;
