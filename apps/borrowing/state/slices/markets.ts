import { createSlice } from '@reduxjs/toolkit';
import { FlagKeys } from '@jarvis-network/ui';

import { initialState, State } from '@/state/initialState';

export type MarketAssetFlag = FlagKeys | null;

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

const marketsSlice = createSlice({
  name: 'markets',
  initialState: initialState.markets,
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
});

export const {
  setMarketsList,
  setMarketsManageKey,
  setMarketsFilterQuery,
} = marketsSlice.actions;
export const { reducer } = marketsSlice;
