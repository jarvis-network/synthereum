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

export interface SynthereumTICInterface extends BaseContract {
  constructor(
    jsonInterface: any[],
    address?: string,
    options?: ContractOptions
  ): SynthereumTICInterface;
  clone(): SynthereumTICInterface;
  methods: {
    /**
     * Get the collateral token
     */
    collateralToken(): NonPayableTransactionObject<string>;

    /**
     * Get Synthereum finder of the pool
     */
    synthereumFinder(): NonPayableTransactionObject<string>;

    /**
     * Get the synthetic token associated to this pool
     */
    syntheticToken(): NonPayableTransactionObject<string>;

    /**
     * Get the synthetic token symbol associated to this pool
     */
    syntheticTokenSymbol(): NonPayableTransactionObject<string>;

    /**
     * Get Synthereum version
     */
    version(): NonPayableTransactionObject<string>;

    mintRequest(
      collateralAmount: number | string,
      numTokens: number | string
    ): NonPayableTransactionObject<void>;

    approveMint(mintID: string | number[]): NonPayableTransactionObject<void>;

    rejectMint(mintID: string | number[]): NonPayableTransactionObject<void>;

    deposit(
      collateralAmount: number | string
    ): NonPayableTransactionObject<void>;

    withdraw(
      collateralAmount: number | string
    ): NonPayableTransactionObject<void>;

    exchangeMint(
      collateralAmount: number | string,
      numTokens: number | string
    ): NonPayableTransactionObject<void>;

    depositIntoDerivative(
      collateralAmount: number | string
    ): NonPayableTransactionObject<void>;

    withdrawRequest(
      collateralAmount: number | string
    ): NonPayableTransactionObject<void>;

    withdrawPassedRequest(): NonPayableTransactionObject<void>;

    redeemRequest(
      collateralAmount: number | string,
      numTokens: number | string
    ): NonPayableTransactionObject<void>;

    approveRedeem(
      redeemID: string | number[]
    ): NonPayableTransactionObject<void>;

    rejectRedeem(
      redeemID: string | number[]
    ): NonPayableTransactionObject<void>;

    emergencyShutdown(): NonPayableTransactionObject<void>;

    settleEmergencyShutdown(): NonPayableTransactionObject<void>;

    exchangeRequest(
      destTIC: string,
      numTokens: number | string,
      collateralAmount: number | string,
      destNumTokens: number | string
    ): NonPayableTransactionObject<void>;

    approveExchange(
      exchangeID: string | number[]
    ): NonPayableTransactionObject<void>;

    rejectExchange(
      exchangeID: string | number[]
    ): NonPayableTransactionObject<void>;

    setFee(
      _fee: [[number | string], string[], (number | string)[]]
    ): NonPayableTransactionObject<void>;

    setFeePercentage(
      _feePercentage: number | string
    ): NonPayableTransactionObject<void>;

    setFeeRecipients(
      _feeRecipients: string[],
      _feeProportions: (number | string)[]
    ): NonPayableTransactionObject<void>;

    derivative(): NonPayableTransactionObject<string>;

    calculateFee(
      collateralAmount: number | string
    ): NonPayableTransactionObject<string>;

    getMintRequests(): NonPayableTransactionObject<
      [string, string, string, [string], [string]][]
    >;

    getRedeemRequests(): NonPayableTransactionObject<
      [string, string, string, [string], [string]][]
    >;

    getExchangeRequests(): NonPayableTransactionObject<
      [string, string, string, string, [string], [string], [string]][]
    >;
  };
  events: {
    allEvents(options?: EventOptions, cb?: Callback<EventLog>): EventEmitter;
  };
}
