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

export interface ISynthereumPool extends BaseContract {
  constructor(
    jsonInterface: any[],
    address?: string,
    options?: ContractOptions
  ): ISynthereumPool;
  clone(): ISynthereumPool;
  methods: {
    collateralToken(): NonPayableTransactionObject<string>;

    synthereumFinder(): NonPayableTransactionObject<string>;

    syntheticToken(): NonPayableTransactionObject<string>;

    syntheticTokenSymbol(): NonPayableTransactionObject<string>;

    version(): NonPayableTransactionObject<string>;

    addDerivative(derivative: string): NonPayableTransactionObject<void>;

    removeDerivative(derivative: string): NonPayableTransactionObject<void>;

    mint(
      mintMetaTx: [
        string,
        string,
        number | string,
        number | string,
        number | string,
        number | string,
        number | string
      ],
      signature: [number | string, string | number[], string | number[]]
    ): NonPayableTransactionObject<string>;

    redeem(
      redeemMetaTx: [
        string,
        string,
        number | string,
        number | string,
        number | string,
        number | string,
        number | string
      ],
      signature: [number | string, string | number[], string | number[]]
    ): NonPayableTransactionObject<string>;

    exchange(
      exchangeMetaTx: [
        string,
        string,
        string,
        string,
        number | string,
        number | string,
        number | string,
        number | string,
        number | string,
        number | string
      ],
      signature: [number | string, string | number[], string | number[]]
    ): NonPayableTransactionObject<string>;

    exchangeMint(
      srcDerivative: string,
      derivative: string,
      collateralAmount: number | string,
      numTokens: number | string
    ): NonPayableTransactionObject<void>;

    withdrawFromPool(
      collateralAmount: number | string
    ): NonPayableTransactionObject<void>;

    depositIntoDerivative(
      derivative: string,
      collateralAmount: number | string
    ): NonPayableTransactionObject<void>;

    slowWithdrawRequest(
      derivative: string,
      collateralAmount: number | string
    ): NonPayableTransactionObject<void>;

    slowWithdrawPassedRequest(
      derivative: string
    ): NonPayableTransactionObject<string>;

    fastWithdraw(
      derivative: string,
      collateralAmount: number | string
    ): NonPayableTransactionObject<string>;

    emergencyShutdown(derivative: string): NonPayableTransactionObject<void>;

    settleEmergencyShutdown(
      derivative: string
    ): NonPayableTransactionObject<string>;

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

    setStartingCollateralization(
      startingCollateralRatio: number | string
    ): NonPayableTransactionObject<void>;

    addRoleInDerivative(
      derivative: string,
      derivativeRole: number | string,
      addressToAdd: string
    ): NonPayableTransactionObject<void>;

    renounceRoleInDerivative(
      derivative: string,
      derivativeRole: number | string
    ): NonPayableTransactionObject<void>;

    addRoleInSynthToken(
      derivative: string,
      synthTokenRole: number | string,
      addressToAdd: string
    ): NonPayableTransactionObject<void>;

    renounceRoleInSynthToken(
      derivative: string,
      synthTokenRole: number | string
    ): NonPayableTransactionObject<void>;

    setIsContractAllowed(
      isContractAllowed: boolean
    ): NonPayableTransactionObject<void>;

    getAllDerivatives(): NonPayableTransactionObject<string[]>;

    isDerivativeAdmitted(
      derivative: string
    ): NonPayableTransactionObject<boolean>;

    getStartingCollateralization(): NonPayableTransactionObject<string>;

    isContractAllowed(): NonPayableTransactionObject<boolean>;

    getFeeInfo(): NonPayableTransactionObject<[[string], string[], string[]]>;

    getUserNonce(user: string): NonPayableTransactionObject<string>;

    calculateFee(
      collateralAmount: number | string
    ): NonPayableTransactionObject<string>;
  };
  events: {
    allEvents(options?: EventOptions, cb?: Callback<EventLog>): EventEmitter;
  };
}
