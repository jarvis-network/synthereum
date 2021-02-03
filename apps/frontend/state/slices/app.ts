import { createSlice } from '@reduxjs/toolkit';

import { initialState } from '@/state/initialState';

interface SetModalVisibilityAction {
  payload: boolean;
}

interface SetMobileTabAction {
  payload: number;
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
    setFullScreenLoaderVisible(state, action: SetModalVisibilityAction) {
      return {
        ...state,
        isFullScreenLoaderVisible: action.payload,
      };
    },
    setAuthModalVisible(state, action: SetModalVisibilityAction) {
      return {
        ...state,
        isAuthModalVisible: action.payload,
      };
    },
    setMobileTab(state, action: SetMobileTabAction) {
      return {
        ...state,
        mobileTab: action.payload,
      };
    },
  },
});

export const {
  setAccountOverviewModalVisible,
  setRecentActivityModalVisible,
  setFullScreenLoaderVisible,
  setAuthModalVisible,
  setMobileTab,
} = appSlice.actions;
export const { reducer } = appSlice;
