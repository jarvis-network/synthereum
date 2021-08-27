import { createSlice } from '@reduxjs/toolkit';
import { StringAmount } from '@jarvis-network/core-utils/dist/base/big-number';
import { PriceFeedSymbols } from '@jarvis-network/synthereum-ts/dist/epics/price-feed';

import { initialAppState } from '../initialState';

const initialState = initialAppState.prices;
interface SetCurrentPriceAction {
  payload: {
    [key in PriceFeedSymbols]?: StringAmount;
  };
}
const priceSlice = createSlice({
  name: 'prices',
  initialState,
  reducers: {
    setCurrentPrice(state, action: SetCurrentPriceAction) {
      return {
        ...state,
        ...action.payload,
      };
    },
  },
});

export const { setCurrentPrice } = priceSlice.actions;
export const { reducer } = priceSlice;
