import { createSlice } from '@reduxjs/toolkit';

import initialState, { State } from '@/state/initialState';

interface SetLoginStateAction {
  payload: State['auth'];
}

const authSlice = createSlice({
  name: 'auth',
  initialState: initialState.auth,
  reducers: {
    setLoginState(state, action: SetLoginStateAction) {
      return action.payload;
    },
  },
});

export const { setLoginState } = authSlice.actions;

export default authSlice.reducer;
