import {createSlice} from "@reduxjs/toolkit";
import initialState from "state/initialState";

interface SetLoginStateAction {
  payload: {
    state: boolean;
  }
}

const authSlice = createSlice({
  name: "auth",
  initialState: initialState.auth,
  reducers: {
    setLoginState(state, action: SetLoginStateAction) {
      state.state = action.payload.state;
    }
  }
});

export const { setLoginState } = authSlice.actions

export default authSlice.reducer
