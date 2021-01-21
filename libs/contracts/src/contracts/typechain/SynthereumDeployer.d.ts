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

export type DerivativeDeployed = ContractEventLog<{
  derivativeVersion: string;
  pool: string;
  newDerivative: string;
  0: string;
  1: string;
  2: string;
}>;
export type PoolDeployed = ContractEventLog<{
  poolVersion: string;
  derivative: string;
  newPool: string;
  0: string;
  1: string;
  2: string;
}>;
export type RoleAdminChanged = ContractEventLog<{
  role: string;
  previousAdminRole: string;
  newAdminRole: string;
  0: string;
  1: string;
  2: string;
}>;
export type RoleGranted = ContractEventLog<{
  role: string;
  account: string;
  sender: string;
  0: string;
  1: string;
  2: string;
}>;
export type RoleRevoked = ContractEventLog<{
  role: string;
  account: string;
  sender: string;
  0: string;
  1: string;
  2: string;
}>;

export interface SynthereumDeployer extends BaseContract {
  constructor(
    jsonInterface: any[],
    address?: string,
    options?: ContractOptions
  ): SynthereumDeployer;
  clone(): SynthereumDeployer;
  methods: {
    DEFAULT_ADMIN_ROLE(): NonPayableTransactionObject<string>;

    MAINTAINER_ROLE(): NonPayableTransactionObject<string>;

    getRoleAdmin(role: string | number[]): NonPayableTransactionObject<string>;

    getRoleMember(
      role: string | number[],
      index: number | string
    ): NonPayableTransactionObject<string>;

    getRoleMemberCount(
      role: string | number[]
    ): NonPayableTransactionObject<string>;

    grantRole(
      role: string | number[],
      account: string
    ): NonPayableTransactionObject<void>;

    hasRole(
      role: string | number[],
      account: string
    ): NonPayableTransactionObject<boolean>;

    renounceRole(
      role: string | number[],
      account: string
    ): NonPayableTransactionObject<void>;

    revokeRole(
      role: string | number[],
      account: string
    ): NonPayableTransactionObject<void>;

    synthereumFinder(): NonPayableTransactionObject<string>;

    deployPoolAndDerivative(
      derivativeVersion: number | string,
      poolVersion: number | string,
      derivativeParamsData: string | number[],
      poolParamsData: string | number[]
    ): NonPayableTransactionObject<{
      derivative: string;
      pool: string;
      0: string;
      1: string;
    }>;

    deployOnlyPool(
      poolVersion: number | string,
      poolParamsData: string | number[],
      derivative: string
    ): NonPayableTransactionObject<string>;

    deployOnlyDerivative(
      derivativeVersion: number | string,
      derivativeParamsData: string | number[],
      pool: string
    ): NonPayableTransactionObject<string>;
  };
  events: {
    DerivativeDeployed(cb?: Callback<DerivativeDeployed>): EventEmitter;
    DerivativeDeployed(
      options?: EventOptions,
      cb?: Callback<DerivativeDeployed>
    ): EventEmitter;

    PoolDeployed(cb?: Callback<PoolDeployed>): EventEmitter;
    PoolDeployed(
      options?: EventOptions,
      cb?: Callback<PoolDeployed>
    ): EventEmitter;

    RoleAdminChanged(cb?: Callback<RoleAdminChanged>): EventEmitter;
    RoleAdminChanged(
      options?: EventOptions,
      cb?: Callback<RoleAdminChanged>
    ): EventEmitter;

    RoleGranted(cb?: Callback<RoleGranted>): EventEmitter;
    RoleGranted(
      options?: EventOptions,
      cb?: Callback<RoleGranted>
    ): EventEmitter;

    RoleRevoked(cb?: Callback<RoleRevoked>): EventEmitter;
    RoleRevoked(
      options?: EventOptions,
      cb?: Callback<RoleRevoked>
    ): EventEmitter;

    allEvents(options?: EventOptions, cb?: Callback<EventLog>): EventEmitter;
  };

  once(event: "DerivativeDeployed", cb: Callback<DerivativeDeployed>): void;
  once(
    event: "DerivativeDeployed",
    options: EventOptions,
    cb: Callback<DerivativeDeployed>
  ): void;

  once(event: "PoolDeployed", cb: Callback<PoolDeployed>): void;
  once(
    event: "PoolDeployed",
    options: EventOptions,
    cb: Callback<PoolDeployed>
  ): void;

  once(event: "RoleAdminChanged", cb: Callback<RoleAdminChanged>): void;
  once(
    event: "RoleAdminChanged",
    options: EventOptions,
    cb: Callback<RoleAdminChanged>
  ): void;

  once(event: "RoleGranted", cb: Callback<RoleGranted>): void;
  once(
    event: "RoleGranted",
    options: EventOptions,
    cb: Callback<RoleGranted>
  ): void;

  once(event: "RoleRevoked", cb: Callback<RoleRevoked>): void;
  once(
    event: "RoleRevoked",
    options: EventOptions,
    cb: Callback<RoleRevoked>
  ): void;
}
