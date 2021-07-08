import { createSlice } from '@reduxjs/toolkit';

import { logoutAction, addressSwitch, networkSwitch } from '@/state/actions';
import { initialAppState } from '@/state/initialState';
import { Transaction } from '@/data/transactions';

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
    addTransaction: (state, { payload: tx }: Action<Transaction>) => {
      state[tx.hash] = tx;
    },
    addTransactions: (state, { payload: txs }: Action<Transaction[]>) => {
      for (const tx of txs) {
        state[tx.hash] = tx;
      }
    },
  },
  extraReducers: {
    [addressSwitch.type]: resetState,
    [logoutAction.type]: resetState,
    [networkSwitch.type]: resetState,
  },
});

export const { reducer } = transactionsSlice;
export const { addTransactions } = transactionsSlice.actions;
