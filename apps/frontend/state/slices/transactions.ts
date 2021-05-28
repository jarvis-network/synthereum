import { createSlice } from '@reduxjs/toolkit';

import { logoutAction, addressSwitch, networkSwitch } from '@/state/actions';
import { initialAppState } from '@/state/initialState';
import { Transaction } from '@/data/transactions';

interface Action<T> {
  payload: T;
}

const initialState = initialAppState.transactions;

const transactionsSlice = createSlice({
  name: 'transactions',
  initialState,
  reducers: {
    addTransaction: (state, { payload: transaction }: Action<Transaction>) => {
      state.list.push(transaction);
    },
  },
  extraReducers: {
    [addressSwitch.type]() {
      return initialState;
    },
    [logoutAction.type]() {
      return initialState;
    },
    [networkSwitch.type]() {
      return initialState;
    },
  },
});

export const { reducer } = transactionsSlice;
