import { createSlice } from '@reduxjs/toolkit';

import { addressSwitch, logoutAction, networkSwitch } from '@/state/actions';
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
    [logoutAction.type]() {
      return initialState;
    },
    [addressSwitch.type]() {
      return initialState;
    },
    [networkSwitch.type]() {
      return initialState;
    },
  },
});

export const {
  reducer,
  actions: { addHistoryItem },
} = historySlice;
