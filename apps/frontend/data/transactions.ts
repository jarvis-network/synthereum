import { SupportedNetworkId } from '@jarvis-network/synthereum-ts/dist/src/config';
import { FPN } from '@jarvis-network/core-utils/dist/base/fixed-point-number';

import { Asset } from './assets';

// @todo After TS library will be implemented:
// move all this types to the library and prepare transformers for frontend

type RawAmount = FPN;

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
  hash: string;
  type: TransactionType;
  networkId: SupportedNetworkId;
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
  collateral?: TransactionIO; // set if type is 'exchange'
}

export type Transaction = SynthereumTransaction;
