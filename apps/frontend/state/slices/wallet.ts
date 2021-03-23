import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

import { ExchangeToken } from '@jarvis-network/synthereum-contracts/dist/src/config';
import { FPN } from '@jarvis-network/web3-utils/base/fixed-point-number';
import { RealmAgent } from '@jarvis-network/synthereum-contracts/dist/src/core/realm-agent';

import { logoutAction } from '@/state/actions';
import { initialState } from '@/state/initialState';

interface Action<T> {
  payload: T;
}

export interface WalletBalance {
  asset: ExchangeToken;
  amount: FPN;
}

export const fetchWalletBalances = createAsyncThunk(
  'wallet/fetch',
  async (realmAgent: RealmAgent): Promise<WalletBalance[]> => {
    const balances = await realmAgent.getAllBalances();

    return balances.map(([asset, amount]) => ({
      asset,
      amount: FPN.fromWei(amount),
    }));
  },
);

export const subscribeWalletBalances = createAsyncThunk(
  'wallet/subscribe',
  (realmAgent: RealmAgent, thunkAPI): void => {
    const callback = () => thunkAPI.dispatch(fetchWalletBalances(realmAgent));
    setInterval(callback, 5000);
    callback();
  },
);

const walletSlice = createSlice({
  name: 'wallet',
  initialState: initialState.wallet,
  reducers: {},
  extraReducers: {
    [fetchWalletBalances.fulfilled.type]: (
      state,
      { payload: balances }: Action<WalletBalance[]>,
    ) => {
      balances.forEach(({ asset, ...value }) => {
        state[asset] = value;
      });
    },
    [logoutAction.type]() {
      return initialState.wallet;
    },
  },
});

export const { reducer } = walletSlice;
