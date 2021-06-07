import { createSlice } from '@reduxjs/toolkit';

import { addressSwitch, logoutAction, networkSwitch } from '@/state/actions';
import { initialAppState, State } from '@/state/initialState';

interface UpdateClaimActionPayload {
  payload: State['claim'];
}

const initialState = initialAppState.claim;

const claimSlice = createSlice({
  name: 'claim',
  initialState,
  reducers: {
    updateClaim(_, action: UpdateClaimActionPayload) {
      return action.payload;
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
  actions: { updateClaim },
} = claimSlice;
