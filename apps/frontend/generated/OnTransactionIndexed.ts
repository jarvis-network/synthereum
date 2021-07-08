/* tslint:disable */
/* eslint-disable */
// @generated
// This file was automatically generated and should not be edited.

import { TransactionType } from "./globalTypes";

// ====================================================
// GraphQL subscription operation: OnTransactionIndexed
// ====================================================

export interface OnTransactionIndexed_users_lastTransactions {
  __typename: "Transaction";
  id: string;
  type: TransactionType;
  timestamp: TheGraphBigInt;
  block: TheGraphBigInt;
  inputTokenAmount: TheGraphBigInt;
  inputTokenAddress: TheGraphBytes;
  outputTokenAmount: TheGraphBigInt;
  outputTokenAddress: TheGraphBytes;
}

export interface OnTransactionIndexed_users {
  __typename: "User";
  lastTransactions: OnTransactionIndexed_users_lastTransactions[];
}

export interface OnTransactionIndexed {
  users: OnTransactionIndexed_users[];
}

export interface OnTransactionIndexedVariables {
  address: string;
  poolVersion: TheGraphBigInt;
}
