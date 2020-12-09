import BN from 'bn.js';

import { Asset, assets } from './assets';

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

interface SynthereumTransaction extends TransactionBase {
  type: 'mint' | 'exchange' | 'redeem';
  ticPoolAddress: string;
  input: TransactionIO;
  output: TransactionIO;
  collateral?: TransactionIO; // set if type is 'exchange'
}

export type Transaction = SynthereumTransaction;

export const transactions: Transaction[] = [
  {
    timestamp: new Date('2020-11-11 05:00:00').getTime(),
    txHash:
      '0x942d266ce26439ee34daf4851425928de246a014ef6db13c84c58b2b545a8dd5',
    type: 'exchange',
    status: 'pending',
    ticPoolAddress: '',
    input: {
      asset: assets.find(_i => _i.symbol === 'jEUR')!,
      amount: new BN('1000'),
    },
    output: {
      asset: assets.find(_i => _i.symbol === 'jGBP')!,
      amount: new BN('700'),
    },
  },
  {
    timestamp: new Date('2020-11-11 04:00:00').getTime(),
    txHash:
      '0x1e9d73c05d2305419c4602a6ec926c8bbd053f4d2e7bfe0ef1db2d691c4219b0',
    type: 'mint',
    status: 'success',
    ticPoolAddress: '',
    input: {
      asset: assets.find(_i => _i.symbol === 'USDC')!,
      amount: new BN('1000'),
    },
    output: {
      asset: assets.find(_i => _i.symbol === 'jEUR')!,
      amount: new BN('999'),
    },
  },
  {
    timestamp: new Date('2020-11-10 04:00:00').getTime(),
    txHash:
      '0xe84e3c49fad89a6e7ac9a76eb985f3baff2e7b31b37e69b94550c49f339ee260',
    type: 'redeem',
    status: 'failure',
    ticPoolAddress: '',
    input: {
      asset: assets.find(_i => _i.symbol === 'jGBP')!,
      amount: new BN('1000'),
    },
    output: {
      asset: assets.find(_i => _i.symbol === 'USDC')!,
      amount: new BN('999'),
    },
  },
];
