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

export type OwnershipTransferred = ContractEventLog<{
  previousOwner: string;
  newOwner: string;
  0: string;
  1: string;
}>;
export type SupportedIdentifierAdded = ContractEventLog<{
  identifier: string;
  0: string;
}>;
export type SupportedIdentifierRemoved = ContractEventLog<{
  identifier: string;
  0: string;
}>;

export interface IdentifierWhitelist extends BaseContract {
  constructor(
    jsonInterface: any[],
    address?: string,
    options?: ContractOptions
  ): IdentifierWhitelist;
  clone(): IdentifierWhitelist;
  methods: {
    /**
     * Returns the address of the current owner.
     */
    owner(): NonPayableTransactionObject<string>;

    /**
     * Leaves the contract without owner. It will not be possible to call `onlyOwner` functions anymore. Can only be called by the current owner. NOTE: Renouncing ownership will leave the contract without an owner, thereby removing any functionality that is only available to the owner.
     */
    renounceOwnership(): NonPayableTransactionObject<void>;

    /**
     * Transfers ownership of the contract to a new account (`newOwner`). Can only be called by the current owner.
     */
    transferOwnership(newOwner: string): NonPayableTransactionObject<void>;

    /**
     * Price requests using this identifier will succeed after this call.
     * Adds the provided identifier as a supported identifier.
     * @param identifier unique UTF-8 representation for the feed being added. Eg: BTC/USD.
     */
    addSupportedIdentifier(
      identifier: string | number[]
    ): NonPayableTransactionObject<void>;

    /**
     * Price requests using this identifier will no longer succeed after this call.
     * Removes the identifier from the whitelist.
     * @param identifier unique UTF-8 representation for the feed being removed. Eg: BTC/USD.
     */
    removeSupportedIdentifier(
      identifier: string | number[]
    ): NonPayableTransactionObject<void>;

    /**
     * Checks whether an identifier is on the whitelist.
     * @param identifier unique UTF-8 representation for the feed being queried. Eg: BTC/USD.
     */
    isIdentifierSupported(
      identifier: string | number[]
    ): NonPayableTransactionObject<boolean>;
  };
  events: {
    OwnershipTransferred(cb?: Callback<OwnershipTransferred>): EventEmitter;
    OwnershipTransferred(
      options?: EventOptions,
      cb?: Callback<OwnershipTransferred>
    ): EventEmitter;

    SupportedIdentifierAdded(
      cb?: Callback<SupportedIdentifierAdded>
    ): EventEmitter;
    SupportedIdentifierAdded(
      options?: EventOptions,
      cb?: Callback<SupportedIdentifierAdded>
    ): EventEmitter;

    SupportedIdentifierRemoved(
      cb?: Callback<SupportedIdentifierRemoved>
    ): EventEmitter;
    SupportedIdentifierRemoved(
      options?: EventOptions,
      cb?: Callback<SupportedIdentifierRemoved>
    ): EventEmitter;

    allEvents(options?: EventOptions, cb?: Callback<EventLog>): EventEmitter;
  };

  once(event: "OwnershipTransferred", cb: Callback<OwnershipTransferred>): void;
  once(
    event: "OwnershipTransferred",
    options: EventOptions,
    cb: Callback<OwnershipTransferred>
  ): void;

  once(
    event: "SupportedIdentifierAdded",
    cb: Callback<SupportedIdentifierAdded>
  ): void;
  once(
    event: "SupportedIdentifierAdded",
    options: EventOptions,
    cb: Callback<SupportedIdentifierAdded>
  ): void;

  once(
    event: "SupportedIdentifierRemoved",
    cb: Callback<SupportedIdentifierRemoved>
  ): void;
  once(
    event: "SupportedIdentifierRemoved",
    options: EventOptions,
    cb: Callback<SupportedIdentifierRemoved>
  ): void;
}
