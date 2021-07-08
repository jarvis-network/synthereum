/* tslint:disable */
/* eslint-disable */
// @generated
// This file was automatically generated and should not be edited.

import { TransactionType } from "./globalTypes";

// ====================================================
// GraphQL query operation: GetNewTransactions
// ====================================================

export interface GetNewTransactions_transactions {
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

export interface GetNewTransactions {
  transactions: GetNewTransactions_transactions[];
}

export interface GetNewTransactionsVariables {
  address: TheGraphBytes;
  blockNumberGreaterThenOrEqualTo: TheGraphBigInt;
  idNotIn: string[];
}
