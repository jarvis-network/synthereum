import { createSlice } from '@reduxjs/toolkit';

import { initialState } from '@/state/initialState';

interface SetModalVisibilityAction {
  payload: boolean;
}

const appSlice = createSlice({
  name: 'app',
  initialState: initialState.app,
  reducers: {
    setAccountOverviewModalVisible(state, action: SetModalVisibilityAction) {
      return {
        ...state,
        isAccountOverviewModalVisible: action.payload,
      };
    },
    setRecentActivityModalVisible(state, action: SetModalVisibilityAction) {
      return {
        ...state,
        isRecentActivityModalVisible: action.payload,
      };
    },
    setAccountDropdownExpanded(state, action: SetModalVisibilityAction) {
      return {
        ...state,
        isAccountDropdownExpanded: action.payload,
      };
    },
    setFullScreenLoaderVisible(state, action: SetModalVisibilityAction) {
      return {
        ...state,
        isFullScreenLoaderVisible: action.payload,
      };
    },
  },
});

export const {
  setAccountOverviewModalVisible,
  setRecentActivityModalVisible,
  setAccountDropdownExpanded,
  setFullScreenLoaderVisible,
} = appSlice.actions;
export const { reducer } = appSlice;
