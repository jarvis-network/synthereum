import { createSlice } from '@reduxjs/toolkit';
import { logoutAction, networkSwitchAction } from '@jarvis-network/app-toolkit';

import {
  DEFAULT_DEADLINE,
  DEFAULT_DISABLE_MULTIHOPS,
  DEFAULT_PAY_ASSET,
  DEFAULT_RECEIVE_ASSET,
  DEFAULT_SLIPPAGE,
  DEFAULT_TRANSACTION_SPEED,
  initialAppState,
  State,
} from '@/state/initialState';
import { resetSwapAction } from '@/state/actions';
import { polygonOnlyAssets } from '@/data/assets';

interface SetChooseAssetAction {
  payload: State['exchange']['chooseAssetActive'];
}

interface SetBaseAction {
  payload: State['exchange']['base'];
}

interface SetPayAction {
  payload: {
    pay: State['exchange']['pay'];
    gasLimit?: State['exchange']['gasLimit'];
  };
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

interface SetPayAndReceiveAssetAction {
  payload: {
    pay: State['exchange']['payAsset'];
    receive: State['exchange']['receiveAsset'];
  };
}

interface SetChartDays {
  payload: State['exchange']['chartDays'];
}

interface SetSlippage {
  payload: State['exchange']['slippage'];
}

interface SetDisableMultihops {
  payload: State['exchange']['disableMultihops'];
}

interface SetDeadline {
  payload: State['exchange']['deadline'];
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
      state.pay = action.payload.pay;
      state.gasLimit = action.payload.gasLimit || 0;
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
    setPayAndReceiveAsset(state, action: SetPayAndReceiveAssetAction) {
      state.payAsset = action.payload.pay;
      state.receiveAsset = action.payload.receive;
    },
    invertRateInfo(state) {
      state.invertRateInfo = !state.invertRateInfo;
    },
    setChartDays(state, action: SetChartDays) {
      state.chartDays = action.payload;
    },
    setSlippage(state, action: SetSlippage) {
      state.slippage = action.payload;
    },
    setDisableMultihops(state, action: SetDisableMultihops) {
      state.disableMultihops = action.payload;
    },
    setDeadline(state, action: SetDeadline) {
      state.deadline = action.payload;
    },
    setTransactionSpeed(state, action: SetTransactionSpeed) {
      state.transactionSpeed = action.payload;
    },
    resetAssetsIfUnsupported: resetAssetsIfUnsupportedReducer,
  },
  extraReducers: {
    [resetSwapAction.type](state) {
      const { base, pay, receive } = initialAppState.exchange;

      return {
        ...state,
        base,
        pay,
        receive,
        gasLimit: 0,
      };
    },
    [networkSwitchAction.type]: resetAssetsIfUnsupportedReducer,
    [logoutAction.type](state) {
      return {
        ...state,
        slippage: DEFAULT_SLIPPAGE,
        deadline: DEFAULT_DEADLINE,
        disableMultihops: DEFAULT_DISABLE_MULTIHOPS,
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
  setPayAndReceiveAsset,
  invertRateInfo,
  setChartDays,
  setSlippage,
  setDisableMultihops,
  setDeadline,
  setTransactionSpeed,
  resetAssetsIfUnsupported,
} = exchangeSlice.actions;

export const { reducer } = exchangeSlice;
