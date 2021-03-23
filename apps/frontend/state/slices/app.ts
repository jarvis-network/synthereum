import { createSlice } from '@reduxjs/toolkit';

import { initialState } from '@/state/initialState';

import { resetSwapAction } from '../actions';

import { fetchWalletBalances } from './wallet';
import { login } from './auth';

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
    setWindowLoaded(state, action: SetModalVisibilityAction) {
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
  },
  extraReducers: {
    [resetSwapAction.type](state) {
      return {
        ...state,
        isSwapLoaderVisible: false,
        isExchangeConfirmationVisible: false,
      };
    },
    [login.type](state) {
      return {
        ...state,
        isExchangeLoaded: false,
      };
    },
    [fetchWalletBalances.fulfilled.type](state) {
      return {
        ...state,
        isExchangeLoaded: true,
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
} = appSlice.actions;
export const { reducer } = appSlice;
