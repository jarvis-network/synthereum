import { createSlice } from '@reduxjs/toolkit';

import { networkSwitch, logoutAction, addressSwitch } from '../actions';

import { initialAppState, OPType } from '../initialState';

import { Action } from './auth';

const initialState = initialAppState.approveTransaction;

const transactionSlice = createSlice({
  name: 'approveTransaction',
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
        error: undefined,
        valid: false,
      };
    },
    metaMaskError(
      state,
      action: Action<{
        message: any;
      }>,
    ) {
      return {
        ...state,
        error: action.payload,
      };
    },
    validate(state) {
      return {
        ...state,
        valid: true,
      };
    },
  },
  extraReducers: {
    [addressSwitch.type]() {
      return initialState;
    },
    [networkSwitch.type]() {
      return initialState;
    },
    [logoutAction.type]() {
      return initialState;
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
