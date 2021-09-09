import { createSlice } from '@reduxjs/toolkit';

import {
  networkSwitchAction,
  addressSwitchAction,
  logoutAction,
} from '@jarvis-network/app-toolkit';
import { initialAppState } from '@/state/initialState';
import {
  updateWalletBalances,
  UpdateWalletBalancesAction,
} from '@/state/actions';
import { FPN } from '@jarvis-network/core-utils/dist/base/fixed-point-number';

const initialState = initialAppState.wallet;

function resetState() {
  return initialState;
}

const walletSlice = createSlice({
  name: 'wallet',
  initialState,
  reducers: {},
  extraReducers: {
    [updateWalletBalances.type](
      state,
      { payload: balances }: UpdateWalletBalancesAction,
    ) {
      for (const { asset, amount } of balances) {
        if (!state[asset] || !amount.eq(state[asset].amount as FPN)) {
          state[asset] = { amount };
        }
      }
    },
    [logoutAction.type]: resetState,
    [addressSwitchAction.type]: resetState,
    [networkSwitchAction.type]: resetState,
  },
});

export const { reducer } = walletSlice;
