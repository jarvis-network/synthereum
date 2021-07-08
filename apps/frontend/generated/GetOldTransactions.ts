/* tslint:disable */
/* eslint-disable */
// @generated
// This file was automatically generated and should not be edited.

import { TransactionType } from "./globalTypes";

// ====================================================
// GraphQL query operation: GetOldTransactions
// ====================================================

export interface GetOldTransactions_transactions {
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

export interface GetOldTransactions {
  transactions: GetOldTransactions_transactions[];
}

export interface GetOldTransactionsVariables {
  address: TheGraphBytes;
  poolVersion: TheGraphBigInt;
  blockNumberLessThanOrEqualTo: TheGraphBigInt;
  idNotIn: string[];
}
