import { createSlice } from '@reduxjs/toolkit';
import { logoutAction, networkSwitchAction } from '@jarvis-network/app-toolkit';

import { initialAppState } from '@/state/initialState';

const initialState = initialAppState.cache;

function resetState() {
  return initialState;
}

const cacheSlice = createSlice({
  name: 'wallet',
  initialState,
  reducers: {
    addToAddressIsContractCache(
      state,
      { payload }: { payload: Record<string, boolean> },
    ) {
      for (const i in payload) {
        if (!Object.prototype.hasOwnProperty.call(payload, i)) continue;
        state.addressIsContract[i] = payload[i];
      }
    },
  },
  extraReducers: {
    [logoutAction.type]: resetState,
    [networkSwitchAction.type]: resetState,
  },
});

export const { addToAddressIsContractCache } = cacheSlice.actions;
export const { reducer } = cacheSlice;
