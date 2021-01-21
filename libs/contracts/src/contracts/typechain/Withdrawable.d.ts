/* Autogenerated file. Do not edit manually. */
/* tslint:disable */
/* eslint-disable */

import BN from "bn.js";
import { ContractOptions } from "web3-eth-contract";
import { EventLog } from "web3-core";
import { EventEmitter } from "events";
import {
  Callback,
  PayableTransactionObject,
  NonPayableTransactionObject,
  BlockType,
  ContractEventLog,
  BaseContract,
} from "./types";

interface EventOptions {
  filter?: object;
  fromBlock?: BlockType;
  topics?: string[];
}

export type AddedSharedMember = ContractEventLog<{
  roleId: string;
  newMember: string;
  manager: string;
  0: string;
  1: string;
  2: string;
}>;
export type RemovedSharedMember = ContractEventLog<{
  roleId: string;
  oldMember: string;
  manager: string;
  0: string;
  1: string;
  2: string;
}>;
export type ResetExclusiveMember = ContractEventLog<{
  roleId: string;
  newMember: string;
  manager: string;
  0: string;
  1: string;
  2: string;
}>;

export interface Withdrawable extends BaseContract {
  constructor(
    jsonInterface: any[],
    address?: string,
    options?: ContractOptions
  ): Withdrawable;
  clone(): Withdrawable;
  methods: {
    addMember(
      roleId: number | string,
      newMember: string
    ): NonPayableTransactionObject<void>;

    getMember(roleId: number | string): NonPayableTransactionObject<string>;

    holdsRole(
      roleId: number | string,
      memberToCheck: string
    ): NonPayableTransactionObject<boolean>;

    removeMember(
      roleId: number | string,
      memberToRemove: string
    ): NonPayableTransactionObject<void>;

    renounceMembership(
      roleId: number | string
    ): NonPayableTransactionObject<void>;

    resetMember(
      roleId: number | string,
      newMember: string
    ): NonPayableTransactionObject<void>;

    withdraw(amount: number | string): NonPayableTransactionObject<void>;

    withdrawErc20(
      erc20Address: string,
      amount: number | string
    ): NonPayableTransactionObject<void>;
  };
  events: {
    AddedSharedMember(cb?: Callback<AddedSharedMember>): EventEmitter;
    AddedSharedMember(
      options?: EventOptions,
      cb?: Callback<AddedSharedMember>
    ): EventEmitter;

    RemovedSharedMember(cb?: Callback<RemovedSharedMember>): EventEmitter;
    RemovedSharedMember(
      options?: EventOptions,
      cb?: Callback<RemovedSharedMember>
    ): EventEmitter;

    ResetExclusiveMember(cb?: Callback<ResetExclusiveMember>): EventEmitter;
    ResetExclusiveMember(
      options?: EventOptions,
      cb?: Callback<ResetExclusiveMember>
    ): EventEmitter;

    allEvents(options?: EventOptions, cb?: Callback<EventLog>): EventEmitter;
  };

  once(event: "AddedSharedMember", cb: Callback<AddedSharedMember>): void;
  once(
    event: "AddedSharedMember",
    options: EventOptions,
    cb: Callback<AddedSharedMember>
  ): void;

  once(event: "RemovedSharedMember", cb: Callback<RemovedSharedMember>): void;
  once(
    event: "RemovedSharedMember",
    options: EventOptions,
    cb: Callback<RemovedSharedMember>
  ): void;

  once(event: "ResetExclusiveMember", cb: Callback<ResetExclusiveMember>): void;
  once(
    event: "ResetExclusiveMember",
    options: EventOptions,
    cb: Callback<ResetExclusiveMember>
  ): void;
}
