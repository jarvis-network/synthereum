import { Tagged } from '../base/tagged-type';

import { Address } from './address';
import { Network, NetworkId, ValueOnNetwork } from './networks';

export type TransactionHash = Tagged<string, 'EthereumTransactionHash'>;

export type TransactionHashOn<
  Net extends Network | undefined
> = Net extends Network
  ? ValueOnNetwork<TransactionHash, Net>
  : TransactionHash;

export type TransactionStatus = 'pending' | 'success' | 'failure';

// Base interface for any kind of transaction
export interface TransactionBase {
  timestamp: number; // we can't store Date in Redux; timestamp is value in MS (as default to JS)
  hash: TransactionHash;
  networkId: NetworkId;
  from: Address;
  block: number;
  // status: TransactionStatus; // TODO: Bring back
}

// Represents a plain ETH or ERC20 token transfer transaction
export interface RegularTransaction extends TransactionBase {
  // 'send' if `from` is our address, 'receive' if `to` is ours, and 'sendToSelf' if both.
  type: 'send' | 'receive' | 'sendToSelf';
  to: Address;
  input: {
    asset: string;
    amount: string;
  };
}
