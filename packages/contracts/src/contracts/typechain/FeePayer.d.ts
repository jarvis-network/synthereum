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

export type FinalFeesPaid = ContractEventLog<{
  amount: string;
  0: string;
}>;
export type RegularFeesPaid = ContractEventLog<{
  regularFee: string;
  lateFee: string;
  0: string;
  1: string;
}>;

export interface FeePayer extends BaseContract {
  constructor(
    jsonInterface: any[],
    address?: string,
    options?: ContractOptions
  ): FeePayer;
  clone(): FeePayer;
  methods: {
    /**
     * **************************************      FEE PAYER DATA STRUCTURES       ****************************************
     */
    collateralCurrency(): NonPayableTransactionObject<string>;

    cumulativeFeeMultiplier(): NonPayableTransactionObject<string>;

    finder(): NonPayableTransactionObject<string>;

    /**
     * Gets the current time. Will return the last time set in `setCurrentTime` if running in test mode. Otherwise, it will return the block timestamp.
     */
    getCurrentTime(): NonPayableTransactionObject<string>;

    /**
     * Will revert if not running in test mode.
     * Sets the current time.
     * @param time timestamp to set current Testable time to.
     */
    setCurrentTime(time: number | string): NonPayableTransactionObject<void>;

    timerAddress(): NonPayableTransactionObject<string>;

    /**
     * These must be paid periodically for the life of the contract. If the contract has not paid its regular fee in a week or more then a late penalty is applied which is sent to the caller. If the amount of fees owed are greater than the pfc, then this will pay as much as possible from the available collateral. An event is only fired if the fees charged are greater than 0.
     * Pays UMA DVM regular fees (as a % of the collateral pool) to the Store contract.
     */
    payRegularFees(): NonPayableTransactionObject<[string]>;

    /**
     * This is equivalent to the collateral pool available from which to pay fees. Therefore, derived contracts are expected to implement this so that pay-fee methods can correctly compute the owed fees as a % of PfC.
     * Gets the current profit from corruption for this contract in terms of the collateral currency.
     */
    pfc(): NonPayableTransactionObject<[string]>;
  };
  events: {
    FinalFeesPaid(cb?: Callback<FinalFeesPaid>): EventEmitter;
    FinalFeesPaid(
      options?: EventOptions,
      cb?: Callback<FinalFeesPaid>
    ): EventEmitter;

    RegularFeesPaid(cb?: Callback<RegularFeesPaid>): EventEmitter;
    RegularFeesPaid(
      options?: EventOptions,
      cb?: Callback<RegularFeesPaid>
    ): EventEmitter;

    allEvents(options?: EventOptions, cb?: Callback<EventLog>): EventEmitter;
  };

  once(event: "FinalFeesPaid", cb: Callback<FinalFeesPaid>): void;
  once(
    event: "FinalFeesPaid",
    options: EventOptions,
    cb: Callback<FinalFeesPaid>
  ): void;

  once(event: "RegularFeesPaid", cb: Callback<RegularFeesPaid>): void;
  once(
    event: "RegularFeesPaid",
    options: EventOptions,
    cb: Callback<RegularFeesPaid>
  ): void;
}
