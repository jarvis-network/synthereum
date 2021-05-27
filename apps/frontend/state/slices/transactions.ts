import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

import { RealmAgent } from '@jarvis-network/synthereum-ts/dist/core/realm-agent';

import { logoutAction, addressSwitch } from '@/state/actions';
import { initialAppState } from '@/state/initialState';
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
    [fetchTransactionsHistory.fulfilled.type]: (
      state,
      { payload: transactions }: Action<Transaction[]>,
    ) => {
      state.list = transactions;
    },
    [addressSwitch.type]() {
      return initialState;
    },
    [logoutAction.type]() {
      return initialState;
    },
  },
});

export const { reducer } = transactionsSlice;
