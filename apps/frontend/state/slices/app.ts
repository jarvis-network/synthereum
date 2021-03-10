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
    setSwapLoaderVisible(state, action: SetModalVisibilityAction) {
      return {
        ...state,
        isSwapLoaderVisible: action.payload,
      };
    },
    setAuthModalVisible(state, action: SetModalVisibilityAction) {
      return {
        ...state,
        isAuthModalVisible: action.payload,
      };
    },
    setExchangeConfirmationVisible(state, action: SetModalVisibilityAction) {
      return {
        ...state,
        isExchangeConfirmationVisible: action.payload,
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
  setSwapLoaderVisible,
  setAuthModalVisible,
  setExchangeConfirmationVisible,
  setMobileTab,
} = appSlice.actions;
export const { reducer } = appSlice;
