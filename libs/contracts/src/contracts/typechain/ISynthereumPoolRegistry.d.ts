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

export interface ISynthereumPoolRegistry extends BaseContract {
  constructor(
    jsonInterface: any[],
    address?: string,
    options?: ContractOptions
  ): ISynthereumPoolRegistry;
  clone(): ISynthereumPoolRegistry;
  methods: {
    /**
     * Allow the deployer to register a pool just deployed
     * @param collateralToken Collateral ERC20 token of the pool deployed
     * @param pool Address of the pool deployed
     * @param poolVersion Version of the pool deployed
     * @param syntheticTokenSymbol Symbol of the syntheticToken
     */
    registerPool(
      syntheticTokenSymbol: string,
      collateralToken: string,
      poolVersion: number | string,
      pool: string
    ): NonPayableTransactionObject<void>;

    /**
     * Returns if a particular pool exists or not
     * @param collateral ERC20 contract of collateral currency
     * @param pool Contract of the pool to check
     * @param poolSymbol Synthetic token symbol of the pool
     * @param poolVersion Version of the pool
     */
    isPoolDeployed(
      poolSymbol: string,
      collateral: string,
      poolVersion: number | string,
      pool: string
    ): NonPayableTransactionObject<boolean>;

    /**
     * Returns all the pools with partcular symbol, collateral and verion
     * @param collateral ERC20 contract of collateral currency
     * @param poolSymbol Synthetic token symbol of the pool
     * @param poolVersion Version of the pool
     */
    getPools(
      poolSymbol: string,
      collateral: string,
      poolVersion: number | string
    ): NonPayableTransactionObject<string[]>;
  };
  events: {
    allEvents(options?: EventOptions, cb?: Callback<EventLog>): EventEmitter;
  };
}
