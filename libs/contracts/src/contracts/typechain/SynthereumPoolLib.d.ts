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

export type AddDerivative = ContractEventLog<{
  pool: string;
  derivative: string;
  0: string;
  1: string;
}>;
export type Exchange = ContractEventLog<{
  account: string;
  sourcePool: string;
  destPool: string;
  numTokensSent: string;
  destNumTokensReceived: string;
  feePaid: string;
  0: string;
  1: string;
  2: string;
  3: string;
  4: string;
  5: string;
}>;
export type Mint = ContractEventLog<{
  account: string;
  pool: string;
  collateralSent: string;
  numTokensReceived: string;
  feePaid: string;
  0: string;
  1: string;
  2: string;
  3: string;
  4: string;
}>;
export type Redeem = ContractEventLog<{
  account: string;
  pool: string;
  numTokensSent: string;
  collateralReceived: string;
  feePaid: string;
  0: string;
  1: string;
  2: string;
  3: string;
  4: string;
}>;
export type RemoveDerivative = ContractEventLog<{
  pool: string;
  derivative: string;
  0: string;
  1: string;
}>;
export type SetFeePercentage = ContractEventLog<{
  feePercentage: string;
  0: string;
}>;
export type SetFeeRecipients = ContractEventLog<{
  feeRecipients: string[];
  feeProportions: string[];
  0: string[];
  1: string[];
}>;
export type Settlement = ContractEventLog<{
  account: string;
  pool: string;
  numTokens: string;
  collateralSettled: string;
  0: string;
  1: string;
  2: string;
  3: string;
}>;

export interface SynthereumPoolLib extends BaseContract {
  constructor(
    jsonInterface: any[],
    address?: string,
    options?: ContractOptions
  ): SynthereumPoolLib;
  clone(): SynthereumPoolLib;
  methods: {};
  events: {
    AddDerivative(cb?: Callback<AddDerivative>): EventEmitter;
    AddDerivative(
      options?: EventOptions,
      cb?: Callback<AddDerivative>
    ): EventEmitter;

    Exchange(cb?: Callback<Exchange>): EventEmitter;
    Exchange(options?: EventOptions, cb?: Callback<Exchange>): EventEmitter;

    Mint(cb?: Callback<Mint>): EventEmitter;
    Mint(options?: EventOptions, cb?: Callback<Mint>): EventEmitter;

    Redeem(cb?: Callback<Redeem>): EventEmitter;
    Redeem(options?: EventOptions, cb?: Callback<Redeem>): EventEmitter;

    RemoveDerivative(cb?: Callback<RemoveDerivative>): EventEmitter;
    RemoveDerivative(
      options?: EventOptions,
      cb?: Callback<RemoveDerivative>
    ): EventEmitter;

    SetFeePercentage(cb?: Callback<SetFeePercentage>): EventEmitter;
    SetFeePercentage(
      options?: EventOptions,
      cb?: Callback<SetFeePercentage>
    ): EventEmitter;

    SetFeeRecipients(cb?: Callback<SetFeeRecipients>): EventEmitter;
    SetFeeRecipients(
      options?: EventOptions,
      cb?: Callback<SetFeeRecipients>
    ): EventEmitter;

    Settlement(cb?: Callback<Settlement>): EventEmitter;
    Settlement(options?: EventOptions, cb?: Callback<Settlement>): EventEmitter;

    allEvents(options?: EventOptions, cb?: Callback<EventLog>): EventEmitter;
  };

  once(event: "AddDerivative", cb: Callback<AddDerivative>): void;
  once(
    event: "AddDerivative",
    options: EventOptions,
    cb: Callback<AddDerivative>
  ): void;

  once(event: "Exchange", cb: Callback<Exchange>): void;
  once(event: "Exchange", options: EventOptions, cb: Callback<Exchange>): void;

  once(event: "Mint", cb: Callback<Mint>): void;
  once(event: "Mint", options: EventOptions, cb: Callback<Mint>): void;

  once(event: "Redeem", cb: Callback<Redeem>): void;
  once(event: "Redeem", options: EventOptions, cb: Callback<Redeem>): void;

  once(event: "RemoveDerivative", cb: Callback<RemoveDerivative>): void;
  once(
    event: "RemoveDerivative",
    options: EventOptions,
    cb: Callback<RemoveDerivative>
  ): void;

  once(event: "SetFeePercentage", cb: Callback<SetFeePercentage>): void;
  once(
    event: "SetFeePercentage",
    options: EventOptions,
    cb: Callback<SetFeePercentage>
  ): void;

  once(event: "SetFeeRecipients", cb: Callback<SetFeeRecipients>): void;
  once(
    event: "SetFeeRecipients",
    options: EventOptions,
    cb: Callback<SetFeeRecipients>
  ): void;

  once(event: "Settlement", cb: Callback<Settlement>): void;
  once(
    event: "Settlement",
    options: EventOptions,
    cb: Callback<Settlement>
  ): void;
}
