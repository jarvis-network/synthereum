import { createSlice } from '@reduxjs/toolkit';

import { initialState, State } from '@/state/initialState';
import { resetSwapAction } from '@/state/actions';

interface SetChooseAssetAction {
  payload: State['exchange']['chooseAssetActive'];
}

interface SetBaseAction {
  payload: State['exchange']['base'];
}

interface SetPayAction {
  payload: State['exchange']['pay'];
}

interface SetReceiveAction {
  payload: State['exchange']['receive'];
}

interface SetPayAssetAction {
  payload: State['exchange']['payAsset'];
}

interface SetReceiveAssetAction {
  payload: State['exchange']['receiveAsset'];
}

interface SetChartDays {
  payload: State['exchange']['chartDays'];
}

const exchangeSlice = createSlice({
  name: 'exchange',
  initialState: initialState.exchange,
  reducers: {
    setChooseAsset(state, action: SetChooseAssetAction) {
      state.chooseAssetActive = action.payload;
    },
    setBase(state, action: SetBaseAction) {
      state.base = action.payload;
    },
    setPay(state, action: SetPayAction) {
      state.pay = action.payload;
    },
    setReceive(state, action: SetReceiveAction) {
      state.receive = action.payload;
    },
    setPayAsset(state, action: SetPayAssetAction) {
      if (action.payload === state.receiveAsset) {
        state.receiveAsset = state.payAsset;
      }
      state.payAsset = action.payload;
    },
    setReceiveAsset(state, action: SetReceiveAssetAction) {
      if (action.payload === state.payAsset) {
        state.payAsset = state.receiveAsset;
      }
      state.receiveAsset = action.payload;
    },
    invertRateInfo(state) {
      state.invertRateInfo = !state.invertRateInfo;
    },
    setChartDays(state, action: SetChartDays) {
      state.chartDays = action.payload;
    },
  },
  extraReducers: {
    [resetSwapAction.type](state) {
      const { base, pay, receive } = initialState.exchange;

      return {
        ...state,
        base,
        pay,
        receive,
      };
    },
  },
});

export const {
  setChooseAsset,
  setBase,
  setPay,
  setReceive,
  setPayAsset,
  setReceiveAsset,
  invertRateInfo,
  setChartDays,
} = exchangeSlice.actions;

export const { reducer } = exchangeSlice;
