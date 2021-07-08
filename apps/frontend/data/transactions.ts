import {
  ExchangeToken,
  SupportedNetworkId,
} from '@jarvis-network/synthereum-ts/dist/src/config';

// @todo After TS library will be implemented:
// move all this types to the library and prepare transformers for frontend

export type TransactionType =
  | 'mint'
  | 'exchange'
  | 'redeem'
  | 'send'
  | 'receive'
  | 'sendToSelf';

export type TransactionStatus = 'pending' | 'success' | 'failure';

export interface TransactionIO {
  asset: ExchangeToken;
  amount: string;
}

// Base interface for any kind of transaction
interface TransactionBase {
  timestamp: number; // we can't store Date in Redux; timestamp is value in MS (as default to JS)
  hash: string;
  type: TransactionType;
  networkId: SupportedNetworkId;
  block: number;
  // status: TransactionStatus; // TODO: Bring back
}

// Represents a plain ETH or ERC20 token transfer transaction
export interface RegularTransaction extends TransactionBase {
  // 'send' if `from` is our address, 'receive' if `to` is ours, and 'sendToSelf' if both.
  type: 'send' | 'receive' | 'sendToSelf';
  from: string;
  to: string;
  input: TransactionIO;
}

export interface SynthereumTransaction extends TransactionBase {
  type: 'mint' | 'exchange' | 'redeem';
  input: TransactionIO;
  output: TransactionIO;
}

export type Transaction = SynthereumTransaction;
