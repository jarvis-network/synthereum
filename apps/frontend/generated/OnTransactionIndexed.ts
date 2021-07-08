/* tslint:disable */
/* eslint-disable */
// @generated
// This file was automatically generated and should not be edited.

import { TransactionType } from "./globalTypes";

// ====================================================
// GraphQL subscription operation: OnTransactionIndexed
// ====================================================

export interface OnTransactionIndexed_user_lastTransactions {
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

export interface OnTransactionIndexed_user {
  __typename: "User";
  lastTransactions: OnTransactionIndexed_user_lastTransactions[];
}

export interface OnTransactionIndexed {
  user: OnTransactionIndexed_user | null;
}

export interface OnTransactionIndexedVariables {
  address: string;
}
