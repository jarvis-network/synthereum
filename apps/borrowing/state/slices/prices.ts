import { createSlice } from '@reduxjs/toolkit';
import { StringAmount } from '@jarvis-network/core-utils/dist/base/big-number';
import { PriceFeedSymbols } from '@jarvis-network/synthereum-ts/dist/epics/price-feed';

import { initialAppState } from '../initialState';
import { networkSwitch, logoutAction } from '../actions';

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
  extraReducers: {
    [networkSwitch.type]() {
      return initialState;
    },
    [logoutAction.type]() {
      return initialState;
    },
  },
});

export const { setCurrentPrice } = priceSlice.actions;
export const { reducer } = priceSlice;
