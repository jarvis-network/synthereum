import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

import { RealmAgent } from '@jarvis-network/synthereum-contracts/dist/src/core/realm-agent';

import { initialState } from '@/state/initialState';
import { Transaction } from '@/data/transactions';

interface Action<T> {
  payload: T;
}

export const fetchTransactionsHistory = createAsyncThunk(
  'transactions/fetch',
  (realmAgent: RealmAgent<'kovan'>): Promise<Transaction[]> => {
    // @todo some logic here
    return Promise.resolve([]);
  },
);

export const subscribeTransactionsHistory = createAsyncThunk(
  'transactions/subscribe',
  async (realmAgent: RealmAgent<'kovan'>, thunkAPI): Promise<void> => {
    setInterval(() => {
      thunkAPI.dispatch(fetchTransactionsHistory(realmAgent));
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
