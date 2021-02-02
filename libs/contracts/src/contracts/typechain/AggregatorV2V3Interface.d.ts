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

export type AnswerUpdated = ContractEventLog<{
  current: string;
  roundId: string;
  updatedAt: string;
  0: string;
  1: string;
  2: string;
}>;
export type NewRound = ContractEventLog<{
  roundId: string;
  startedBy: string;
  startedAt: string;
  0: string;
  1: string;
  2: string;
}>;

export interface AggregatorV2V3Interface extends BaseContract {
  constructor(
    jsonInterface: any[],
    address?: string,
    options?: ContractOptions
  ): AggregatorV2V3Interface;
  clone(): AggregatorV2V3Interface;
  methods: {
    decimals(): NonPayableTransactionObject<string>;

    description(): NonPayableTransactionObject<string>;

    getAnswer(roundId: number | string): NonPayableTransactionObject<string>;

    getRoundData(
      _roundId: number | string
    ): NonPayableTransactionObject<{
      roundId: string;
      answer: string;
      startedAt: string;
      updatedAt: string;
      answeredInRound: string;
      0: string;
      1: string;
      2: string;
      3: string;
      4: string;
    }>;

    getTimestamp(roundId: number | string): NonPayableTransactionObject<string>;

    latestAnswer(): NonPayableTransactionObject<string>;

    latestRound(): NonPayableTransactionObject<string>;

    latestRoundData(): NonPayableTransactionObject<{
      roundId: string;
      answer: string;
      startedAt: string;
      updatedAt: string;
      answeredInRound: string;
      0: string;
      1: string;
      2: string;
      3: string;
      4: string;
    }>;

    latestTimestamp(): NonPayableTransactionObject<string>;

    version(): NonPayableTransactionObject<string>;
  };
  events: {
    AnswerUpdated(cb?: Callback<AnswerUpdated>): EventEmitter;
    AnswerUpdated(
      options?: EventOptions,
      cb?: Callback<AnswerUpdated>
    ): EventEmitter;

    NewRound(cb?: Callback<NewRound>): EventEmitter;
    NewRound(options?: EventOptions, cb?: Callback<NewRound>): EventEmitter;

    allEvents(options?: EventOptions, cb?: Callback<EventLog>): EventEmitter;
  };

  once(event: "AnswerUpdated", cb: Callback<AnswerUpdated>): void;
  once(
    event: "AnswerUpdated",
    options: EventOptions,
    cb: Callback<AnswerUpdated>
  ): void;

  once(event: "NewRound", cb: Callback<NewRound>): void;
  once(event: "NewRound", options: EventOptions, cb: Callback<NewRound>): void;
}
