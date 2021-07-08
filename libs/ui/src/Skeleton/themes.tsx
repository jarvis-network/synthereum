import { createMuiTheme } from '@material-ui/core';

import { lightTheme, nightTheme, darkTheme } from '../Theme/themes';
import { ThemeName } from '../Theme/types';

export const skeletonThemesMap = {
  [ThemeName.light]: createMuiTheme({
    components: {
      MuiSkeleton: {
        styleOverrides: {
          circular: {
            backgroundColor: lightTheme.background.skeletonLoader,
          },
          rectangular: {
            backgroundColor: lightTheme.background.skeletonLoader,
            borderRadius: '0.3em',
          },
          text: {
            backgroundColor: lightTheme.background.skeletonLoader,
            borderRadius: '0.5em',
          },
        },
      },
    },
  }),
  [ThemeName.dark]: createMuiTheme({
    components: {
      MuiSkeleton: {
        styleOverrides: {
          circular: {
            backgroundColor: darkTheme.background.skeletonLoader,
          },
          rectangular: {
            backgroundColor: darkTheme.background.skeletonLoader,
            borderRadius: '0.3em',
          },
          text: {
            backgroundColor: darkTheme.background.skeletonLoader,
            borderRadius: '0.5em',
          },
        },
      },
    },
  }),
  [ThemeName.night]: createMuiTheme({
    components: {
      MuiSkeleton: {
        styleOverrides: {
          circular: {
            backgroundColor: nightTheme.background.skeletonLoader,
          },
          rectangular: {
            backgroundColor: nightTheme.background.skeletonLoader,
            borderRadius: '0.3em',
          },
          text: {
            backgroundColor: nightTheme.background.skeletonLoader,
            borderRadius: '0.5em',
          },
        },
      },
    },
  }),
} as const;
