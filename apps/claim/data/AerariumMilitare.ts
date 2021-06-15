import { EventEmitter } from 'events';

import {
  BaseContract,
  NonPayableTransactionObject,
} from '@jarvis-network/core-utils/dist/eth/contracts/typechain/types';
import { Address } from '@jarvis-network/core-utils/dist/eth/address';
import { EventLog } from 'web3-core/types';

interface ContractEventLog<T> extends EventLog {
  returnValues: T;
}
type Claim = ContractEventLog<{
  currentAmount: string;
  totalAmount: string;
  0: string;
  1: string;
}>;

type BlockType = 'latest' | 'pending' | 'genesis' | number;

interface EventOptions {
  filter?: Record<string, string>;
  fromBlock?: BlockType;
  topics?: string[];
}
type Callback<T> = (error: Error, result: T) => void;

export interface AerariumMilitare extends BaseContract {
  methods: {
    claimedAmount(address: Address): NonPayableTransactionObject<string>;
    userTotalAmount(address: Address): NonPayableTransactionObject<string>;
    claimableJRT(address: Address): NonPayableTransactionObject<string>;

    startTime(): NonPayableTransactionObject<string>;
    endTime(): NonPayableTransactionObject<string>;

    totalTokenAmount(): NonPayableTransactionObject<string>;

    claim(): NonPayableTransactionObject<void>;
    liquidate(addresses: Address[]): NonPayableTransactionObject<string>;
  };

  events: {
    Claim(cb?: Callback<Claim>): EventEmitter;
    Claim(options?: EventOptions, cb?: Callback<Claim>): EventEmitter;
  };
}
