import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

import { initialState } from '@/state/initialState';
import { Transaction } from '@/data/transactions';

interface Action<T> {
  payload: T;
}

export const fetchTransactionsHistory = createAsyncThunk(
  'transactions/fetch',
  (): Promise<Transaction[]> => {
    // @todo some logic here
    return Promise.resolve([]);
  },
);

export const subscribeTransactionsHistory = createAsyncThunk(
  'transactions/subscribe',
  async (_, thunkAPI): Promise<void> => {
    setInterval(() => {
      thunkAPI.dispatch(fetchTransactionsHistory());
    }, 5000);
  },
);

const transactionsSlice = createSlice({
  name: 'transactions',
  initialState: initialState.transactions,
  reducers: {
    setTransactionsHistory: (
      state,
      { payload: transactions }: Action<Transaction[]>,
    ) => {
      // eslint-disable-next-line no-param-reassign
      state.list = transactions;
    },
    addTransaction: (state, { payload: transaction }: Action<Transaction>) => {
      state.list.push(transaction);
    },
  },
  extraReducers: {
    [fetchTransactionsHistory.fulfilled.type]: (
      state,
      { payload: transactions }: Action<Transaction[]>,
    ) => {
      // eslint-disable-next-line no-param-reassign
      state.list = transactions;
    },
  },
});

export const { reducer } = transactionsSlice;
