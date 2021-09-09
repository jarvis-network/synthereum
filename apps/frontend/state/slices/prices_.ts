import { createSlice } from '@reduxjs/toolkit';

import { initialAppState } from '@/state/initialState';
import { FPN } from '@jarvis-network/core-utils/dist/base/fixed-point-number';

interface Action<T> {
  payload: T;
}

type SetAssetsPriceAction = Action<Record<string, number>>;

const assetsSlice = createSlice({
  name: 'prices',
  initialState: initialAppState.prices,
  reducers: {
    setAssetsPrice(state, { payload }: SetAssetsPriceAction) {
      // eslint-disable-next-line guard-for-in
      for (const i in payload) {
        state[i] = new FPN(payload[i]);
      }
    },
  },
});

export const { reducer } = assetsSlice;
export const { setAssetsPrice } = assetsSlice.actions;
