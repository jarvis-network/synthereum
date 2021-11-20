import { createSlice } from '@reduxjs/toolkit';

import {
  DEFAULT_PAY_ASSET,
  DEFAULT_RECEIVE_ASSET,
  DEFAULT_TRANSACTION_SPEED,
  initialAppState,
  State,
} from '@/state/initialState';
import { resetSwapAction } from '@/state/actions';
import { logoutAction, networkSwitchAction } from '@jarvis-network/app-toolkit';
import { polygonOnlyAssets } from '@/data/assets';

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

interface SetTransactionSpeed {
  payload: State['exchange']['transactionSpeed'];
}

const exchangeSlice = createSlice({
  name: 'exchange',
  initialState: initialAppState.exchange,
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
    setTransactionSpeed(state, action: SetTransactionSpeed) {
      state.transactionSpeed = action.payload;
    },

    resetAssetsIfUnsupported: resetAssetsIfUnsupportedReducer,
  },
  extraReducers: {
    [networkSwitchAction.type]: resetAssetsIfUnsupportedReducer,
    [resetSwapAction.type](state) {
      const { base, pay, receive } = initialAppState.exchange;

      return {
        ...state,
        base,
        pay,
        receive,
      };
    },
    [logoutAction.type](state) {
      return {
        ...state,
        transactionSpeed: DEFAULT_TRANSACTION_SPEED,
      };
    },
  },
});

function resetAssetsIfUnsupportedReducer(
  state: typeof initialAppState.exchange,
) {
  if (polygonOnlyAssets.includes(state.payAsset as 'jPHP')) {
    state.payAsset = DEFAULT_PAY_ASSET;
    if (state.receiveAsset === DEFAULT_PAY_ASSET) {
      state.receiveAsset = DEFAULT_RECEIVE_ASSET;
    }
  }
  if (polygonOnlyAssets.includes(state.receiveAsset as 'jPHP')) {
    state.receiveAsset = DEFAULT_RECEIVE_ASSET;
    if (state.payAsset === DEFAULT_RECEIVE_ASSET) {
      state.payAsset = DEFAULT_PAY_ASSET;
    }
  }
}

export const {
  setChooseAsset,
  setBase,
  setPay,
  setReceive,
  setPayAsset,
  setReceiveAsset,
  invertRateInfo,
  setChartDays,
  setTransactionSpeed,
  resetAssetsIfUnsupported,
} = exchangeSlice.actions;

export const { reducer } = exchangeSlice;
