import { createSlice } from '@reduxjs/toolkit';

import { initialAppState } from '@/state/initialState';

import { resetSwapAction } from '../actions';

interface BooleanAction {
  payload: boolean;
}

interface SetMobileTabAction {
  payload: number;
}

const appSlice = createSlice({
  name: 'app',
  initialState: initialAppState.app,
  reducers: {
    setAccountOverviewModalVisible(state, action: BooleanAction) {
      return {
        ...state,
        isAccountOverviewModalVisible: action.payload,
      };
    },
    setRecentActivityModalVisible(state, action: BooleanAction) {
      return {
        ...state,
        isRecentActivityModalVisible: action.payload,
      };
    },
    setFullScreenLoaderVisible(state, action: BooleanAction) {
      return {
        ...state,
        isFullScreenLoaderVisible: action.payload,
      };
    },
    setSwapLoaderVisible(state, action: BooleanAction) {
      return {
        ...state,
        isSwapLoaderVisible: action.payload,
      };
    },
    setAuthModalVisible(state, action: BooleanAction) {
      return {
        ...state,
        isAuthModalVisible: action.payload,
      };
    },
    setExchangeConfirmationVisible(state, action: BooleanAction) {
      return {
        ...state,
        isExchangeConfirmationVisible: action.payload,
      };
    },
    setWindowLoaded(state, action: BooleanAction) {
      return {
        ...state,
        isWindowLoaded: action.payload,
      };
    },
    setMobileTab(state, action: SetMobileTabAction) {
      return {
        ...state,
        mobileTab: action.payload,
      };
    },
    setExchangeSettingsVisible(state, action: BooleanAction) {
      return {
        ...state,
        areExchangeSettingsVisible: action.payload,
      };
    },
  },
  extraReducers: {
    [resetSwapAction.type](state) {
      return {
        ...state,
        isSwapLoaderVisible: false,
        isExchangeConfirmationVisible: false,
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
  setWindowLoaded,
  setMobileTab,
  setExchangeSettingsVisible,
} = appSlice.actions;
export const { reducer } = appSlice;
