import { createSlice } from '@reduxjs/toolkit';

import { logoutAction } from '@/state/actions';
import { initialState, State } from '@/state/initialState';

interface LoginActionPayload {
  payload: State['auth'];
}

const authSlice = createSlice({
  name: 'auth',
  initialState: initialState.auth,
  reducers: {
    login(_, action: LoginActionPayload) {
      return action.payload;
    },
  },
  extraReducers: {
    [logoutAction.type]() {
      return initialState.auth;
    },
  },
});

export const { login } = authSlice.actions;
export const { reducer } = authSlice;
