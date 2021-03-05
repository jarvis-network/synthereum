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

export interface SynthereumManager extends BaseContract {
  constructor(
    jsonInterface: any[],
    address?: string,
    options?: ContractOptions
  ): SynthereumManager;
  clone(): SynthereumManager;
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

    /**
     * Allow to add roles in derivatives and synthetic tokens contracts
     * @param accounts Addresses to which give the grant
     * @param contracts Derivatives or Synthetic role contracts
     * @param roles Roles id
     */
    grantSynthereumRole(
      contracts: string[],
      roles: (string | number[])[],
      accounts: string[]
    ): NonPayableTransactionObject<void>;

    /**
     * Allow to revoke roles in derivatives and synthetic tokens contracts
     * @param accounts Addresses to which revoke the grant
     * @param contracts Derivatives or Synthetic role contracts
     * @param roles Roles id
     */
    revokeSynthereumRole(
      contracts: string[],
      roles: (string | number[])[],
      accounts: string[]
    ): NonPayableTransactionObject<void>;

    /**
     * Allow to renounce roles in derivatives and synthetic tokens contracts
     * @param contracts Derivatives or Synthetic role contracts
     * @param roles Roles id
     */
    renounceSynthereumRole(
      contracts: string[],
      roles: (string | number[])[]
    ): NonPayableTransactionObject<void>;

    /**
     * Allow to call emergency shutdown in derivative contracts
     * @param derivatives Derivate contracts to shutdown
     */
    emergencyShutdown(derivatives: string[]): NonPayableTransactionObject<void>;
  };
  events: {
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
