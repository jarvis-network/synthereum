import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

import { ExchangeToken } from '@jarvis-network/synthereum-ts/dist/config';
import { FPN } from '@jarvis-network/core-utils/dist/base/fixed-point-number';
import { RealmAgent } from '@jarvis-network/synthereum-ts/dist/core/realm-agent';

import { logoutAction, addressSwitch, networkSwitch } from '@/state/actions';
import { initialAppState, State } from '@/state/initialState';

interface Action<T> {
  payload: T;
}

export interface WalletBalance {
  asset: ExchangeToken;
  amount: FPN;
}

type PrivateState = {
  walletPrivate: {
    fetchingBalancesFor: { address: string; blockNumber: number } | null;
  };
};

type FetchWalletBalancesArgument = RealmAgent;
export const fetchWalletBalances = createAsyncThunk<
  WalletBalance[],
  FetchWalletBalancesArgument,
  { state: State & PrivateState }
>('wallet/fetch', async (realmAgent, { signal }) => {
  const balances = await realmAgent.getAllBalances();
  if (signal.aborted) throw new Error('fetchWalletBalances aborted');
  return balances.map(([asset, amount]) => ({
    asset,
    amount: FPN.fromWei(amount),
  }));
});

const initialState = initialAppState.wallet;

function resetState() {
  return initialState;
}

const walletSlice = createSlice({
  name: 'wallet',
  initialState,
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
    [logoutAction.type]: resetState,
    [addressSwitch.type]: resetState,
    [networkSwitch.type]: resetState,
  },
});

export const { reducer } = walletSlice;
