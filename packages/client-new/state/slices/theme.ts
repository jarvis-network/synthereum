import { createSlice } from '@reduxjs/toolkit';
import { ThemeNameType } from '@jarvis-network/ui';

import initialState from '@/state/initialState';

interface SetThemeAction {
  payload: {
    theme: ThemeNameType;
  };
}

const themeSlice = createSlice({
  name: 'theme',
  initialState: initialState.theme,
  reducers: {
    setTheme(state, action: SetThemeAction) {
      return action.payload.theme;
    },
  },
});

export const { setTheme } = themeSlice.actions;

export default themeSlice.reducer;
