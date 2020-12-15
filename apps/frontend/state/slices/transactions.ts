import { createSlice } from '@reduxjs/toolkit';

import { initialState } from '@/state/initialState';

const transactionsSlice = createSlice({
  name: 'transactions',
  initialState: initialState.transactions,
  reducers: {},
});

export const { reducer } = transactionsSlice;
