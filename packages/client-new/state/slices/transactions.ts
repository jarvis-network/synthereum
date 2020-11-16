import { createSlice } from '@reduxjs/toolkit';

import { initialState } from '@/state/initialState';

const transactionsSlice = createSlice({
  name: 'assets',
  initialState: initialState.transactions,
  reducers: {},
});

export const { reducer } = transactionsSlice;
