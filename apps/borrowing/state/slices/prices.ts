import { createSlice } from '@reduxjs/toolkit';
import { StringAmount } from '@jarvis-network/core-utils/dist/base/big-number';
import { PriceFeedSymbols } from '@jarvis-network/synthereum-ts/dist/epics/price-feed';

import {
  networkSwitchAction,
  logoutAction,
  addressSwitchAction,
} from '@jarvis-network/app-toolkit/dist/sharedActions';

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
  extraReducers: {
    [addressSwitchAction.type]() {
      return initialState;
    },
    [networkSwitchAction.type]() {
      return initialState;
    },
    [logoutAction.type]() {
      return initialState;
    },
  },
});

export const { setCurrentPrice } = priceSlice.actions;
export const { reducer } = priceSlice;
