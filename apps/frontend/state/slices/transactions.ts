import { createSlice } from '@reduxjs/toolkit';
import {
  networkSwitchAction,
  addressSwitchAction,
  logoutAction,
} from '@jarvis-network/app-toolkit';

import { initialAppState } from '@/state/initialState';
import { SynthereumTransaction } from '@/data/transactions';

interface Action<T> {
  payload: T;
}

const initialState = initialAppState.transactions;

function resetState() {
  return initialState;
}

const transactionsSlice = createSlice({
  name: 'transactions',
  initialState,
  reducers: {
    addTransaction: (
      state,
      { payload: transaction }: Action<SynthereumTransaction>,
    ) => {
      state.list.push(transaction);
    },
  },
  extraReducers: {
    [logoutAction.type]: resetState,
    [networkSwitchAction.type]: resetState,
    [addressSwitchAction.type]: resetState,
  },
});

export const { reducer } = transactionsSlice;
