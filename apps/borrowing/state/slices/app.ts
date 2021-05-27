import { createSlice } from '@reduxjs/toolkit';

import { initialAppState } from '@/state/initialState';

interface SetModalVisibilityAction {
  payload: boolean;
}

const initialState = initialAppState.app;

const appSlice = createSlice({
  name: 'app',
  initialState,
  reducers: {
    setAuthModalVisible(state, action: SetModalVisibilityAction) {
      return {
        ...state,
        isAuthModalVisible: action.payload,
      };
    },
  },
});

export const { setAuthModalVisible } = appSlice.actions;
export const { reducer } = appSlice;
