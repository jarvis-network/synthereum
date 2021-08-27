import { createSlice } from '@reduxjs/toolkit';

import { initialAppState, OPType } from '../initialState';

import { Action } from './auth';

const initialState = initialAppState.transaction;

const transactionSlice = createSlice({
  name: 'transaction',
  initialState,
  reducers: {
    metaMaskConfirmation(
      state,
      action: Action<{
        params: any;
        opType: OPType | 'cancel';
      }>,
    ) {
      return {
        ...state,
        ...action.payload,
      };
    },
    send(
      state,
      action: Action<{
        txHash: string;
      }>,
    ) {
      return {
        ...state,
        ...action.payload,
      };
    },
    confirmed(
      state,
      action: Action<{
        receipt: any;
      }>,
    ) {
      return {
        ...state,
        ...action.payload,
      };
    },
    cancel(state) {
      return {
        ...state,
        opType: 'cancel',
        params: undefined,
        receipt: undefined,
        txHash: undefined,
      };
    },
    reset(state) {
      return {
        ...state,
        opType: undefined,
        params: undefined,
        receipt: undefined,
        txHash: undefined,
      };
    },
  },
});

export const {
  metaMaskConfirmation,
  send,
  cancel,
  confirmed,
} = transactionSlice.actions;
export const { reducer } = transactionSlice;
