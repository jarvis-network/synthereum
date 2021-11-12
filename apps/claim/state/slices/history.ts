import { createSlice } from '@reduxjs/toolkit';
import {
  logoutAction,
  addressSwitchAction,
  networkSwitchAction,
} from '@jarvis-network/app-toolkit';

import { initialAppState, State } from '@/state/initialState';

interface UpdateHistoryActionPayload {
  payload: State['history'][number];
}

const initialState = initialAppState.history;

const historySlice = createSlice({
  name: 'history',
  initialState,
  reducers: {
    addHistoryItem(state, { payload: newItem }: UpdateHistoryActionPayload) {
      if (
        !state.find(item => item.transactionHash === newItem.transactionHash)
      ) {
        return state.concat(newItem);
      }

      return state;
    },
  },
  extraReducers: {
    [logoutAction.type]: resetState,
    [addressSwitchAction.type]: resetState,
    [networkSwitchAction.type]: resetState,
  },
});

function resetState() {
  return initialState;
}

export const {
  reducer,
  actions: { addHistoryItem },
} = historySlice;
