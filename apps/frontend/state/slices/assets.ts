import { createSlice } from '@reduxjs/toolkit';

import { FPN } from '@jarvis-network/core-utils/dist/base/fixed-point-number';

import { initialAppState } from '@/state/initialState';
import { PricesMap, SubscriptionPair } from '@/utils/priceFeed';

interface Action<T> {
  payload: T;
}

type SetAssetsPriceAction = Action<PricesMap>;

const assetsSlice = createSlice({
  name: 'assets',
  initialState: initialAppState.assets,
  reducers: {
    setAssetsPrice(state, { payload }: SetAssetsPriceAction) {
      const pairs = Object.keys(payload) as SubscriptionPair[];

      for (const pair of pairs) {
        const assetIndex = state.list.findIndex(i => i.pair === pair);

        if (assetIndex < 0) {
          continue;
        }

        state.list[assetIndex].price = new FPN(payload[pair]);
      }
    },
  },
});

export const { reducer } = assetsSlice;
export const { setAssetsPrice } = assetsSlice.actions;
