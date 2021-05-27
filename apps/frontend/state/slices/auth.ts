import { createSlice } from '@reduxjs/toolkit';

import { initialAppState, State } from '@/state/initialState';
import { logoutAction, addressSwitch } from '@/state/actions';

interface Action<T> {
  payload: T;
}

type LoginActionPayload = Action<State['auth']>;

const initialState = initialAppState.auth;

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    login(_, action: LoginActionPayload) {
      return action.payload;
    },
  },
  extraReducers: {
    [logoutAction.type]() {
      return initialState;
    },
    [addressSwitch.type](
      state,
      { payload: { address } }: Action<{ address: string }>,
    ) {
      if (!state) return state;
      state.address = address;
      return state;
    },
  },
});

export const { login } = authSlice.actions;
export const { reducer } = authSlice;
