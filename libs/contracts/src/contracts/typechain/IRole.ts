/* File autogenerated by synthereum-lib. Do not edit manually. */
/* eslint-disable */

import BN from 'bn.js';
import { ContractOptions } from 'web3-eth-contract';
import { EventLog } from 'web3-core';
import { EventEmitter } from 'events';
import {
  Callback,
  PayableTransactionObject,
  NonPayableTransactionObject,
  BlockType,
  ContractEventLog,
  BaseContract,
} from './types';

interface EventOptions {
  filter?: object;
  fromBlock?: BlockType;
  topics?: string[];
}

export interface IRole extends BaseContract {
  constructor(
    jsonInterface: any[],
    address?: string,
    options?: ContractOptions,
  ): IRole;
  clone(): IRole;
  methods: {
    getRoleAdmin(role: string | number[]): NonPayableTransactionObject<string>;

    getRoleMember(
      role: string | number[],
      index: number | string | BN,
    ): NonPayableTransactionObject<string>;

    getRoleMemberCount(
      role: string | number[],
    ): NonPayableTransactionObject<string>;

    grantRole(
      role: string | number[],
      account: string,
    ): NonPayableTransactionObject<void>;

    hasRole(
      role: string | number[],
      account: string,
    ): NonPayableTransactionObject<boolean>;

    renounceRole(
      role: string | number[],
      account: string,
    ): NonPayableTransactionObject<void>;

    revokeRole(
      role: string | number[],
      account: string,
    ): NonPayableTransactionObject<void>;
  };
  events: {
    allEvents(options?: EventOptions, cb?: Callback<EventLog>): EventEmitter;
  };
}
