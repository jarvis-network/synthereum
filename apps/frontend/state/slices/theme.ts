import { createSlice } from '@reduxjs/toolkit';

import { initialAppState, State } from '@/state/initialState';

interface SetThemeAction {
  payload: {
    theme: State['theme'];
  };
}

const themeSlice = createSlice({
  name: 'theme',
  initialState: initialAppState.theme,
  reducers: {
    setTheme(state, action: SetThemeAction) {
      return action.payload.theme;
    },
  },
});

export const { setTheme } = themeSlice.actions;
export const { reducer } = themeSlice;
