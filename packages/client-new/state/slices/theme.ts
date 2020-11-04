import { createSlice } from '@reduxjs/toolkit';

import initialState, { State } from '@/state/initialState';

interface SetThemeAction {
  payload: {
    theme: State['theme'];
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
