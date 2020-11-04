import { createSlice } from '@reduxjs/toolkit';

import initialState, { State } from '@/state/initialState';

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

const exchangeSlice = createSlice({
  name: 'exchange',
  initialState: initialState.exchange,
  reducers: {
    setChooseAsset(state, action: SetChooseAssetAction) {
      // eslint-disable-next-line no-param-reassign
      state.chooseAssetActive = action.payload;
    },
    setBase(state, action: SetBaseAction) {
      // eslint-disable-next-line no-param-reassign
      state.base = action.payload;
    },
    setPay(state, action: SetPayAction) {
      // eslint-disable-next-line no-param-reassign
      state.pay = action.payload;
    },
    setReceive(state, action: SetReceiveAction) {
      // eslint-disable-next-line no-param-reassign
      state.receive = action.payload;
    },
    setPayAsset(state, action: SetPayAssetAction) {
      // eslint-disable-next-line no-param-reassign
      state.payAsset = action.payload;
    },
    setReceiveAsset(state, action: SetReceiveAssetAction) {
      // eslint-disable-next-line no-param-reassign
      state.receiveAsset = action.payload;
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
} = exchangeSlice.actions;

export default exchangeSlice.reducer;
