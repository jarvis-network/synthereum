import { createSlice } from '@reduxjs/toolkit';

import initialState from '@/state/initialState';

const walletSlice = createSlice({
  name: 'wallet',
  initialState: initialState.wallet,
  reducers: {},
});

export default walletSlice.reducer;
