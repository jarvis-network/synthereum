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

export interface IDerivative extends BaseContract {
  constructor(
    jsonInterface: any[],
    address?: string,
    options?: ContractOptions
  ): IDerivative;
  clone(): IDerivative;
  methods: {
    addAdminAndPool(adminAndPool: string): NonPayableTransactionObject<void>;

    collateralCurrency(): NonPayableTransactionObject<string>;

    getAdminMembers(): NonPayableTransactionObject<string[]>;

    getPoolMembers(): NonPayableTransactionObject<string[]>;

    renounceAdmin(): NonPayableTransactionObject<void>;

    tokenCurrency(): NonPayableTransactionObject<string>;

    feePayerData(): NonPayableTransactionObject<
      [string, string, string, [string]]
    >;

    positionManagerData(): NonPayableTransactionObject<
      [string, string, string, [string], [string], string, string]
    >;

    globalPositionData(): NonPayableTransactionObject<[[string], [string]]>;

    depositTo(
      sponsor: string,
      collateralAmount: [number | string]
    ): NonPayableTransactionObject<void>;

    deposit(
      collateralAmount: [number | string]
    ): NonPayableTransactionObject<void>;

    withdraw(
      collateralAmount: [number | string]
    ): NonPayableTransactionObject<[string]>;

    requestWithdrawal(
      collateralAmount: [number | string]
    ): NonPayableTransactionObject<void>;

    withdrawPassedRequest(): NonPayableTransactionObject<[string]>;

    cancelWithdrawal(): NonPayableTransactionObject<void>;

    create(
      collateralAmount: [number | string],
      numTokens: [number | string]
    ): NonPayableTransactionObject<void>;

    redeem(numTokens: [number | string]): NonPayableTransactionObject<[string]>;

    repay(numTokens: [number | string]): NonPayableTransactionObject<void>;

    settleEmergencyShutdown(): NonPayableTransactionObject<[string]>;

    emergencyShutdown(): NonPayableTransactionObject<void>;

    remargin(): NonPayableTransactionObject<void>;

    trimExcess(token: string): NonPayableTransactionObject<[string]>;

    addPool(pool: string): NonPayableTransactionObject<void>;

    addAdmin(admin: string): NonPayableTransactionObject<void>;

    renouncePool(): NonPayableTransactionObject<void>;

    renounceAdminAndPool(): NonPayableTransactionObject<void>;

    addSyntheticTokenMinter(
      derivative: string
    ): NonPayableTransactionObject<void>;

    addSyntheticTokenBurner(
      derivative: string
    ): NonPayableTransactionObject<void>;

    addSyntheticTokenAdmin(
      derivative: string
    ): NonPayableTransactionObject<void>;

    addSyntheticTokenAdminAndMinterAndBurner(
      derivative: string
    ): NonPayableTransactionObject<void>;

    renounceSyntheticTokenMinter(): NonPayableTransactionObject<void>;

    renounceSyntheticTokenBurner(): NonPayableTransactionObject<void>;

    renounceSyntheticTokenAdmin(): NonPayableTransactionObject<void>;

    renounceSyntheticTokenAdminAndMinterAndBurner(): NonPayableTransactionObject<void>;

    getCollateral(sponsor: string): NonPayableTransactionObject<[string]>;

    totalPositionCollateral(): NonPayableTransactionObject<[string]>;

    emergencyShutdownPrice(): NonPayableTransactionObject<[string]>;
  };
  events: {
    allEvents(options?: EventOptions, cb?: Callback<EventLog>): EventEmitter;
  };
}
