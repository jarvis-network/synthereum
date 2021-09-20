import { createSlice } from '@reduxjs/toolkit';

import { initialAppState } from '@/state/initialState';

interface Action<T> {
  payload: T;
}

const initialState = initialAppState.app;

const appSlice = createSlice({
  name: 'app',
  initialState,
  reducers: {
    contextUpdate(
      state,
      action: Action<{
        networkId: number;
        agentAddress: string;
      }>,
    ) {
      state.networkId = action.payload.networkId;
      state.agentAddress = action.payload.agentAddress;
    },
    setAuthModalVisible(state, action: Action<boolean>) {
      return {
        ...state,
        isAuthModalVisible: action.payload,
      };
    },
    setUnsupportedNetworkModalVisible(state, action: Action<boolean>) {
      return {
        ...state,
        isUnsupportedNetworkModalVisible: action.payload,
      };
    },
    setWindowLoaded(state, action: Action<boolean>) {
      return {
        ...state,
        isWindowLoaded: action.payload,
      };
    },
    setPoolingFrequency(state, action: Action<number>) {
      return {
        ...state,
        poolingFrequency: action.payload,
      };
    },
  },
});

export const {
  setAuthModalVisible,
  setUnsupportedNetworkModalVisible,
  setWindowLoaded,
  contextUpdate,
  setPoolingFrequency,
} = appSlice.actions;
export const { reducer } = appSlice;
