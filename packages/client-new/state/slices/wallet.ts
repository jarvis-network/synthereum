import { createSlice } from '@reduxjs/toolkit';

import { initialState } from '@/state/initialState';

const walletSlice = createSlice({
  name: 'wallet',
  initialState: initialState.wallet,
  reducers: {},
});

export const { reducer } = walletSlice;
