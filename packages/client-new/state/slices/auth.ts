import {createSlice} from "@reduxjs/toolkit";
import initialState from "state/initialState";
import {UserState} from "bnc-onboard/dist/src/interfaces";

interface SetLoginStateAction {
  payload: Omit<UserState, "wallet">,
}

const authSlice = createSlice({
  name: "auth",
  initialState: initialState.auth,
  reducers: {
    setLoginState(state, action: SetLoginStateAction) {
      return action.payload;
    }
  }
});

export const { setLoginState } = authSlice.actions

export default authSlice.reducer
