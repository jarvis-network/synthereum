import { createSlice } from '@reduxjs/toolkit';

import { addressSwitch, networkSwitch } from '@/state/actions';
import { initialAppState, State } from '@/state/initialState';

export type MarketAssetFlag = string | null;

export interface MarketAsset {
  name: string;
  icon: MarketAssetFlag;
}

export interface Market {
  key: string;
  assetIn: MarketAsset;
  assetOut: MarketAsset;
  collateralizationRatio: number;
  liquidationRatio: number;
  assetOutMinted?: number;
  collateral?: number;
}

interface Action<T> {
  payload: T;
}

const initialState = initialAppState.markets;

const marketsSlice = createSlice({
  name: 'markets',
  initialState,
  reducers: {
    setMarketsList(state, { payload: list }: Action<State['markets']['list']>) {
      return {
        ...state,
        list,
      };
    },
    setMarketsManageKey(
      state,
      { payload: manageKey }: Action<State['markets']['manageKey']>,
    ) {
      return {
        ...state,
        manageKey,
      };
    },
    setMarketsFilterQuery(
      state,
      { payload: filterQuery }: Action<State['markets']['filterQuery']>,
    ) {
      return {
        ...state,
        filterQuery,
      };
    },
  },
  extraReducers: {
    [addressSwitch.type]() {
      return initialState;
    },
    [networkSwitch.type]() {
      return initialState;
    },
  },
});

export const {
  setMarketsList,
  setMarketsManageKey,
  setMarketsFilterQuery,
} = marketsSlice.actions;
export const { reducer } = marketsSlice;
