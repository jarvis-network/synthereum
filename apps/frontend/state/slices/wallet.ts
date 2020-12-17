import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

import { initialState, State } from '@/state/initialState';
import { SyntheticSymbol } from '@jarvis-network/synthereum-contracts/dist/src/config';
import { PrimaryStableCoin } from '@jarvis-network/synthereum-contracts/dist/src/config/data/stable-coin';
import { FPN } from '@jarvis-network/web3-utils/base/fixed-point-number';

interface Action<T> {
  payload: T;
}

export interface WalletBalance {
  asset: SyntheticSymbol | PrimaryStableCoin;
  amount: FPN;
}

export const fetchWalletBalances = createAsyncThunk(
  'wallet/fetch',
  (): Promise<WalletBalance[]> => {
    // @todo some logic here
    return Promise.resolve([]);
  }
);

export const subscribeWalletBalances = createAsyncThunk(
  'wallet/subscribe',
  async (_, thunkAPI): Promise<void> => {
    setInterval(() => {
      thunkAPI.dispatch(fetchWalletBalances());
    }, 5000);
  },
);

const walletSlice = createSlice({
  name: 'wallet',
  initialState: initialState.wallet,
  reducers: {
    setWalletBalance(_, { payload }: Action<State['wallet']>) {
      return payload;
    },
    setWalletAmount(
      state,
      { payload: { asset, ...value } }: Action<WalletBalance>,
    ) {
      // eslint-disable-next-line no-param-reassign
      state[asset] = value;
    },
  },
  extraReducers: {
    [fetchWalletBalances.fulfilled.type]: (
      state,
      { payload: balances }: Action<WalletBalance[]>,
    ) => {
      balances.forEach(({ asset, ...value }) => {
        // eslint-disable-next-line no-param-reassign
        state[asset] = value;
      });
    },
  },
});

export const { reducer } = walletSlice;
export const { setWalletAmount, setWalletBalance } = walletSlice.actions;
