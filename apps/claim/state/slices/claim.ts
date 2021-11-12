import { createSlice } from '@reduxjs/toolkit';
import {
  logoutAction,
  addressSwitchAction,
  networkSwitchAction,
} from '@jarvis-network/app-toolkit';

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
  actions: { updateClaim },
} = claimSlice;
