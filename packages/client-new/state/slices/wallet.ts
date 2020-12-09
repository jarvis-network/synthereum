import { createSlice } from '@reduxjs/toolkit';

import { initialState, State } from '@/state/initialState';

interface SetBalanceAction {
  payload: State['wallet'];
}

const walletSlice = createSlice({
  name: 'wallet',
  initialState: initialState.wallet,
  reducers: {
    setWalletBalance(state, { payload }: SetBalanceAction) {
      return payload;
    },
  },
});

export const { reducer } = walletSlice;
export const { setWalletBalance } = walletSlice.actions;
