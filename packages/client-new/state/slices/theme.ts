import {createSlice} from "@reduxjs/toolkit";
import initialState from "state/initialState";
import {ThemeNameType} from "@jarvis-network/ui";

interface SetThemeAction {
  payload: {
    theme: ThemeNameType
  }
}

const themeSlice = createSlice({
  name: "theme",
  initialState: initialState.theme,
  reducers: {
    setTheme(state, action: SetThemeAction) {
      return action.payload.theme;
    }
  }
});

export const { setTheme } = themeSlice.actions

export default themeSlice.reducer
