import { createSlice } from '@reduxjs/toolkit';

import { ExchangeSelfMintingToken } from '@jarvis-network/synthereum-ts/dist/config';

import {
  networkSwitchAction,
  logoutAction,
  addressSwitchAction,
} from '@jarvis-network/app-toolkit/dist/sharedActions';
import { initialAppState } from '@/state/initialState';
import { StringAmount } from '@jarvis-network/core-utils/dist/base/big-number';

interface Action<T> {
  payload: T;
}
export interface WalletBalance {
  asset: ExchangeSelfMintingToken;
  amount: StringAmount;
}
const initialState = initialAppState.wallet;

const walletSlice = createSlice({
  name: 'wallet',
  initialState,
  reducers: {
    setWalletBalances(state, { payload: list }: Action<WalletBalance[]>) {
      list.forEach(({ asset, amount }) => {
        state[asset] = { amount };
      });
    },
  },
  extraReducers: {
    [logoutAction.type]() {
      return initialState;
    },
    [addressSwitchAction.type]() {
      return initialState;
    },
    [networkSwitchAction.type]() {
      return initialState;
    },
  },
});

export const { reducer } = walletSlice;
