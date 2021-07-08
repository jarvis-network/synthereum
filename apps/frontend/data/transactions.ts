import {
  ExchangeToken,
  SupportedNetworkId,
} from '@jarvis-network/synthereum-contracts/dist/config';
import { TransactionBase } from '@jarvis-network/core-utils/dist/eth/transaction';

// #region TODO: Move to libs/synthereum-ts
export type SynthereumTransactionType = 'mint' | 'exchange' | 'redeem';

export interface TransactionIO {
  asset: ExchangeToken;
  amount: string;
}

export interface SynthereumTransaction extends TransactionBase {
  type: SynthereumTransactionType;
  input: TransactionIO;
  output: TransactionIO;
  networkId: SupportedNetworkId;
}
// #endregion
