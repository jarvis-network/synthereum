/* tslint:disable */
/* eslint-disable */
// @generated
// This file was automatically generated and should not be edited.

import { TransactionType } from "./globalTypes";

// ====================================================
// GraphQL query operation: GetTransactions
// ====================================================

export interface GetTransactions_transactions {
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

export interface GetTransactions {
  transactions: GetTransactions_transactions[];
}

export interface GetTransactionsVariables {
  address: TheGraphBytes;
  poolVersion: TheGraphBigInt;
}
