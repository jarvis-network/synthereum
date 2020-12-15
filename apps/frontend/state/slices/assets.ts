import { createSlice } from '@reduxjs/toolkit';

import { initialState } from '@/state/initialState';

const assetsSlice = createSlice({
  name: 'assets',
  initialState: initialState.assets,
  reducers: {},
});

export const { reducer } = assetsSlice;
