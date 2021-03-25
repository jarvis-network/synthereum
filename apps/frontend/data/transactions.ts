import BN from 'bn.js';

import { Asset } from './assets';

// @todo After TS library will be implemented:
// move all this types to the library and prepare transformers for frontend

type RawAmount = BN;

export type TransactionType =
  | 'mint'
  | 'exchange'
  | 'redeem'
  | 'send'
  | 'receive'
  | 'sendToSelf';

export type TransactionStatus = 'pending' | 'success' | 'failure';

export interface TransactionIO {
  asset: Asset;
  amount: RawAmount;
}

// Base interface for any kind of transaction
interface TransactionBase {
  timestamp: number; // we can't store Date in Redux; timestamp is value in MS (as default to JS)
  txHash: string;
  type: TransactionType;
  status: TransactionStatus;
}

// Represents a plain ETH or ERC20 token transfer transaction
interface RegularTransaction extends TransactionBase {
  // 'send' if `from` is our address, 'receive' if `to` is ours, and 'sendToSelf' if both.
  type: 'send' | 'receive' | 'sendToSelf';
  from: string;
  to: string;
  input: TransactionIO;
}

export interface SynthereumTransaction extends TransactionBase {
  type: 'mint' | 'exchange' | 'redeem';
  ticPoolAddress: string;
  input: TransactionIO;
  output: TransactionIO;
  collateral?: TransactionIO; // set if type is 'exchange'
}

export type Transaction = SynthereumTransaction;
