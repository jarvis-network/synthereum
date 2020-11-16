import { Asset, assets } from './assets';

type RawAmount = string; // originally biging native ECMAScript 2020 type or polyfill like 'BN.js'

type TransactionType =
  | 'mint'
  | 'exchange'
  | 'redeem'
  | 'send'
  | 'receive'
  | 'sendToSelf';

type TransactionStatus = 'pending' | 'success' | 'failure';

export interface TransactionIO {
  asset: Asset;
  amount: RawAmount;
}

// Base interface for any kind of transaction
interface TransactionBase {
  timestamp: number; // we can't store Date in Redux
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
    txHash: '',
    type: 'exchange',
    status: 'pending',
    ticPoolAddress: '',
    input: {
      asset: assets.find(_i => _i.symbol === 'jEUR'),
      amount: '1000',
    },
    output: {
      asset: assets.find(_i => _i.symbol === 'jGBP'),
      amount: '700',
    },
  },
  {
    timestamp: new Date('2020-11-11 04:00:00').getTime(),
    txHash: '',
    type: 'mint',
    status: 'success',
    ticPoolAddress: '',
    input: {
      asset: assets.find(_i => _i.symbol === 'USDC'),
      amount: '1000',
    },
    output: {
      asset: assets.find(_i => _i.symbol === 'jUSD'),
      amount: '999',
    },
  },
  {
    timestamp: new Date('2020-11-10 04:00:00').getTime(),
    txHash: '',
    type: 'redeem',
    status: 'failure',
    ticPoolAddress: '',
    input: {
      asset: assets.find(_i => _i.symbol === 'jUSD'),
      amount: '1000',
    },
    output: {
      asset: assets.find(_i => _i.symbol === 'USDC'),
      amount: '999',
    },
  },
];
