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

export interface ISynthereumFactoryVersioning extends BaseContract {
  constructor(
    jsonInterface: any[],
    address?: string,
    options?: ContractOptions
  ): ISynthereumFactoryVersioning;
  clone(): ISynthereumFactoryVersioning;
  methods: {
    setPoolFactory(
      version: number | string,
      poolFactory: string
    ): NonPayableTransactionObject<void>;

    removePoolFactory(
      version: number | string
    ): NonPayableTransactionObject<void>;

    setDerivativeFactory(
      version: number | string,
      derivativeFactory: string
    ): NonPayableTransactionObject<void>;

    removeDerivativeFactory(
      version: number | string
    ): NonPayableTransactionObject<void>;

    getPoolFactoryVersion(
      version: number | string
    ): NonPayableTransactionObject<string>;

    numberOfVerisonsOfPoolFactory(): NonPayableTransactionObject<string>;

    getDerivativeFactoryVersion(
      version: number | string
    ): NonPayableTransactionObject<string>;

    numberOfVerisonsOfDerivativeFactory(): NonPayableTransactionObject<string>;
  };
  events: {
    allEvents(options?: EventOptions, cb?: Callback<EventLog>): EventEmitter;
  };
}
