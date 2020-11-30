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

export interface StoreInterface extends BaseContract {
  constructor(
    jsonInterface: any[],
    address?: string,
    options?: ContractOptions
  ): StoreInterface;
  clone(): StoreInterface;
  methods: {
    /**
     * To be used by contracts whose margin currency is ETH.
     * Pays Oracle fees in ETH to the store.
     */
    payOracleFees(): PayableTransactionObject<void>;

    payOracleFeesErc20(
      erc20Address: string,
      amount: [number | string]
    ): NonPayableTransactionObject<void>;

    computeRegularFee(
      startTime: number | string,
      endTime: number | string,
      pfc: [number | string]
    ): NonPayableTransactionObject<{
      regularFee: [string];
      latePenalty: [string];
      0: [string];
      1: [string];
    }>;

    /**
     * Computes the final oracle fees that a contract should pay at settlement.
     * @param currency token used to pay the final fee.
     */
    computeFinalFee(currency: string): NonPayableTransactionObject<[string]>;
  };
  events: {
    allEvents(options?: EventOptions, cb?: Callback<EventLog>): EventEmitter;
  };
}
