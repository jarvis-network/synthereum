import React from 'react';
import { ThemeProvider } from '@jarvis-network/ui';

import { useReduxSelector } from '@/state/useReduxSelector';

const themeOverrides = {
  rwd: {
    breakpoints: [1080],
    desktopIndex: 1,
  },
};

export const AppThemeProvider: React.FC = ({ children }) => {
  const theme = useReduxSelector(state => state.theme);

  return (
    <ThemeProvider theme={theme} custom={themeOverrides}>
      {children}
    </ThemeProvider>
  );
};
