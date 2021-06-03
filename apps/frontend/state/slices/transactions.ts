import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

import { RealmAgent } from '@jarvis-network/synthereum-ts/dist/core/realm-agent';

import { logoutAction } from '@/state/actions';
import { initialState } from '@/state/initialState';
import { Transaction } from '@/data/transactions';

interface Action<T> {
  payload: T;
}

export const fetchTransactionsHistory = createAsyncThunk(
  'transactions/fetch',
  (_: RealmAgent): Promise<Transaction[]> =>
    // @todo some logic here
    Promise.resolve([]),
);

export const subscribeTransactionsHistory = createAsyncThunk(
  'transactions/subscribe',
  (realmAgent: RealmAgent, thunkAPI): void => {
    const callback = () =>
      thunkAPI.dispatch(fetchTransactionsHistory(realmAgent));
    setInterval(callback, 5000);
    callback();
  },
);

const transactionsSlice = createSlice({
  name: 'transactions',
  initialState: initialState.transactions,
  reducers: {
    addTransaction: (state, { payload: transaction }: Action<Transaction>) => {
      state.list.push(transaction);
    },
  },
  extraReducers: {
    [fetchTransactionsHistory.fulfilled.type]: (
      state,
      { payload: transactions }: Action<Transaction[]>,
    ) => {
      state.list = transactions;
    },
    [logoutAction.type](state) {
      state.list = [];
    },
  },
});

export const { reducer } = transactionsSlice;
