import { createAction } from '@reduxjs/toolkit';
import { FPN } from '@jarvis-network/core-utils/dist/base/fixed-point-number';

export interface Action<T> {
  payload: T;
}

// Contains actions that multiple slices will be subscribing to

export const resetSwapAction = createAction('resetSwap');

export interface WalletBalance {
  asset: string;
  amount: FPN;
}
export const updateWalletBalances = createAction<WalletBalance[]>(
  'updateWalletBalances',
);
export type UpdateWalletBalancesAction = Action<WalletBalance[]>;
