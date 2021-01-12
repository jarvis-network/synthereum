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

export type DisputeSettled = ContractEventLog<{
  caller: string;
  sponsor: string;
  liquidator: string;
  disputer: string;
  liquidationId: string;
  disputeSucceeded: boolean;
  0: string;
  1: string;
  2: string;
  3: string;
  4: string;
  5: boolean;
}>;
export type LiquidationCreated = ContractEventLog<{
  sponsor: string;
  liquidator: string;
  liquidationId: string;
  tokensOutstanding: string;
  lockedCollateral: string;
  liquidatedCollateral: string;
  liquidationTime: string;
  0: string;
  1: string;
  2: string;
  3: string;
  4: string;
  5: string;
  6: string;
}>;
export type LiquidationDisputed = ContractEventLog<{
  sponsor: string;
  liquidator: string;
  disputer: string;
  liquidationId: string;
  disputeBondAmount: string;
  0: string;
  1: string;
  2: string;
  3: string;
  4: string;
}>;
export type LiquidationWithdrawn = ContractEventLog<{
  caller: string;
  paidToLiquidator: string;
  paidToDisputer: string;
  paidToSponsor: string;
  liquidationStatus: string;
  settlementPrice: string;
  0: string;
  1: string;
  2: string;
  3: string;
  4: string;
  5: string;
}>;

export interface PerpetualLiquidatablePoolPartyLib extends BaseContract {
  constructor(
    jsonInterface: any[],
    address?: string,
    options?: ContractOptions
  ): PerpetualLiquidatablePoolPartyLib;
  clone(): PerpetualLiquidatablePoolPartyLib;
  methods: {};
  events: {
    DisputeSettled(cb?: Callback<DisputeSettled>): EventEmitter;
    DisputeSettled(
      options?: EventOptions,
      cb?: Callback<DisputeSettled>
    ): EventEmitter;

    LiquidationCreated(cb?: Callback<LiquidationCreated>): EventEmitter;
    LiquidationCreated(
      options?: EventOptions,
      cb?: Callback<LiquidationCreated>
    ): EventEmitter;

    LiquidationDisputed(cb?: Callback<LiquidationDisputed>): EventEmitter;
    LiquidationDisputed(
      options?: EventOptions,
      cb?: Callback<LiquidationDisputed>
    ): EventEmitter;

    LiquidationWithdrawn(cb?: Callback<LiquidationWithdrawn>): EventEmitter;
    LiquidationWithdrawn(
      options?: EventOptions,
      cb?: Callback<LiquidationWithdrawn>
    ): EventEmitter;

    allEvents(options?: EventOptions, cb?: Callback<EventLog>): EventEmitter;
  };

  once(event: "DisputeSettled", cb: Callback<DisputeSettled>): void;
  once(
    event: "DisputeSettled",
    options: EventOptions,
    cb: Callback<DisputeSettled>
  ): void;

  once(event: "LiquidationCreated", cb: Callback<LiquidationCreated>): void;
  once(
    event: "LiquidationCreated",
    options: EventOptions,
    cb: Callback<LiquidationCreated>
  ): void;

  once(event: "LiquidationDisputed", cb: Callback<LiquidationDisputed>): void;
  once(
    event: "LiquidationDisputed",
    options: EventOptions,
    cb: Callback<LiquidationDisputed>
  ): void;

  once(event: "LiquidationWithdrawn", cb: Callback<LiquidationWithdrawn>): void;
  once(
    event: "LiquidationWithdrawn",
    options: EventOptions,
    cb: Callback<LiquidationWithdrawn>
  ): void;
}
