import React from 'react';
import { ThemeProvider } from '@jarvis-network/ui';

const themeOverrides = {
  rwd: {
    breakpoints: [1080],
    desktopIndex: 1,
  },
};

export const AppThemeProvider: React.FC = ({ children }) => {
  const theme = 'light';

  return (
    <ThemeProvider theme={theme} custom={themeOverrides}>
      {children}
    </ThemeProvider>
  );
};
