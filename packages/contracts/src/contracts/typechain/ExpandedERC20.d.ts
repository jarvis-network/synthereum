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

export type AddedSharedMember = ContractEventLog<{
  roleId: string;
  newMember: string;
  manager: string;
  0: string;
  1: string;
  2: string;
}>;
export type Approval = ContractEventLog<{
  owner: string;
  spender: string;
  value: string;
  0: string;
  1: string;
  2: string;
}>;
export type RemovedSharedMember = ContractEventLog<{
  roleId: string;
  oldMember: string;
  manager: string;
  0: string;
  1: string;
  2: string;
}>;
export type ResetExclusiveMember = ContractEventLog<{
  roleId: string;
  newMember: string;
  manager: string;
  0: string;
  1: string;
  2: string;
}>;
export type Transfer = ContractEventLog<{
  from: string;
  to: string;
  value: string;
  0: string;
  1: string;
  2: string;
}>;

export interface ExpandedERC20 extends BaseContract {
  constructor(
    jsonInterface: any[],
    address?: string,
    options?: ContractOptions
  ): ExpandedERC20;
  clone(): ExpandedERC20;
  methods: {
    /**
     * Reverts if `roleId` does not represent an initialized, SharedRole or if the caller is not a member of the managing role for `roleId`.
     * Adds `newMember` to the shared role, `roleId`.
     * @param newMember the new SharedRole member.
     * @param roleId the SharedRole membership to modify.
     */
    addMember(
      roleId: number | string,
      newMember: string
    ): NonPayableTransactionObject<void>;

    /**
     * See {IERC20-allowance}.
     */
    allowance(
      owner: string,
      spender: string
    ): NonPayableTransactionObject<string>;

    /**
     * See {IERC20-approve}. Requirements: - `spender` cannot be the zero address.
     */
    approve(
      spender: string,
      amount: number | string
    ): NonPayableTransactionObject<boolean>;

    /**
     * See {IERC20-balanceOf}.
     */
    balanceOf(account: string): NonPayableTransactionObject<string>;

    /**
     * Returns the number of decimals used to get its user representation. For example, if `decimals` equals `2`, a balance of `505` tokens should be displayed to a user as `5,05` (`505 / 10 ** 2`). Tokens usually opt for a value of 18, imitating the relationship between Ether and Wei. This is the value {ERC20} uses, unless {_setupDecimals} is called. NOTE: This information is only used for _display_ purposes: it in no way affects any of the arithmetic of the contract, including {IERC20-balanceOf} and {IERC20-transfer}.
     */
    decimals(): NonPayableTransactionObject<string>;

    /**
     * Atomically decreases the allowance granted to `spender` by the caller. This is an alternative to {approve} that can be used as a mitigation for problems described in {IERC20-approve}. Emits an {Approval} event indicating the updated allowance. Requirements: - `spender` cannot be the zero address. - `spender` must have allowance for the caller of at least `subtractedValue`.
     */
    decreaseAllowance(
      spender: string,
      subtractedValue: number | string
    ): NonPayableTransactionObject<boolean>;

    /**
     * Reverts if `roleId` does not represent an initialized, exclusive role.
     * Gets the current holder of the exclusive role, `roleId`.
     * @param roleId the ExclusiveRole membership to check.
     */
    getMember(roleId: number | string): NonPayableTransactionObject<string>;

    /**
     * Reverts if roleId does not correspond to an initialized role.
     * Whether `memberToCheck` is a member of roleId.
     * @param memberToCheck the address to check.
     * @param roleId the Role to check.
     */
    holdsRole(
      roleId: number | string,
      memberToCheck: string
    ): NonPayableTransactionObject<boolean>;

    /**
     * Atomically increases the allowance granted to `spender` by the caller. This is an alternative to {approve} that can be used as a mitigation for problems described in {IERC20-approve}. Emits an {Approval} event indicating the updated allowance. Requirements: - `spender` cannot be the zero address.
     */
    increaseAllowance(
      spender: string,
      addedValue: number | string
    ): NonPayableTransactionObject<boolean>;

    /**
     * Returns the name of the token.
     */
    name(): NonPayableTransactionObject<string>;

    /**
     * Reverts if `roleId` does not represent an initialized, SharedRole or if the caller is not a member of the managing role for `roleId`.
     * Removes `memberToRemove` from the shared role, `roleId`.
     * @param memberToRemove the current SharedRole member to remove.
     * @param roleId the SharedRole membership to modify.
     */
    removeMember(
      roleId: number | string,
      memberToRemove: string
    ): NonPayableTransactionObject<void>;

    /**
     * Reverts if the caller is not a member of the role for `roleId` or if `roleId` is not an initialized, SharedRole.
     * Removes caller from the role, `roleId`.
     * @param roleId the SharedRole membership to modify.
     */
    renounceMembership(
      roleId: number | string
    ): NonPayableTransactionObject<void>;

    /**
     * Reverts if the caller is not a member of the managing role for `roleId` or if `roleId` is not an initialized, ExclusiveRole.
     * Changes the exclusive role holder of `roleId` to `newMember`.
     * @param newMember the new ExclusiveRole member.
     * @param roleId the ExclusiveRole membership to modify.
     */
    resetMember(
      roleId: number | string,
      newMember: string
    ): NonPayableTransactionObject<void>;

    /**
     * Returns the symbol of the token, usually a shorter version of the name.
     */
    symbol(): NonPayableTransactionObject<string>;

    /**
     * See {IERC20-totalSupply}.
     */
    totalSupply(): NonPayableTransactionObject<string>;

    /**
     * See {IERC20-transfer}. Requirements: - `recipient` cannot be the zero address. - the caller must have a balance of at least `amount`.
     */
    transfer(
      recipient: string,
      amount: number | string
    ): NonPayableTransactionObject<boolean>;

    /**
     * See {IERC20-transferFrom}. Emits an {Approval} event indicating the updated allowance. This is not required by the EIP. See the note at the beginning of {ERC20}. Requirements: - `sender` and `recipient` cannot be the zero address. - `sender` must have a balance of at least `amount`. - the caller must have allowance for ``sender``'s tokens of at least `amount`.
     */
    transferFrom(
      sender: string,
      recipient: string,
      amount: number | string
    ): NonPayableTransactionObject<boolean>;

    /**
     * Mints `value` tokens to `recipient`, returning true on success.
     * @param recipient address to mint to.
     * @param value amount of tokens to mint.
     */
    mint(
      recipient: string,
      value: number | string
    ): NonPayableTransactionObject<boolean>;

    /**
     * Burns `value` tokens owned by `msg.sender`.
     * @param value amount of tokens to burn.
     */
    burn(value: number | string): NonPayableTransactionObject<void>;
  };
  events: {
    AddedSharedMember(cb?: Callback<AddedSharedMember>): EventEmitter;
    AddedSharedMember(
      options?: EventOptions,
      cb?: Callback<AddedSharedMember>
    ): EventEmitter;

    Approval(cb?: Callback<Approval>): EventEmitter;
    Approval(options?: EventOptions, cb?: Callback<Approval>): EventEmitter;

    RemovedSharedMember(cb?: Callback<RemovedSharedMember>): EventEmitter;
    RemovedSharedMember(
      options?: EventOptions,
      cb?: Callback<RemovedSharedMember>
    ): EventEmitter;

    ResetExclusiveMember(cb?: Callback<ResetExclusiveMember>): EventEmitter;
    ResetExclusiveMember(
      options?: EventOptions,
      cb?: Callback<ResetExclusiveMember>
    ): EventEmitter;

    Transfer(cb?: Callback<Transfer>): EventEmitter;
    Transfer(options?: EventOptions, cb?: Callback<Transfer>): EventEmitter;

    allEvents(options?: EventOptions, cb?: Callback<EventLog>): EventEmitter;
  };

  once(event: "AddedSharedMember", cb: Callback<AddedSharedMember>): void;
  once(
    event: "AddedSharedMember",
    options: EventOptions,
    cb: Callback<AddedSharedMember>
  ): void;

  once(event: "Approval", cb: Callback<Approval>): void;
  once(event: "Approval", options: EventOptions, cb: Callback<Approval>): void;

  once(event: "RemovedSharedMember", cb: Callback<RemovedSharedMember>): void;
  once(
    event: "RemovedSharedMember",
    options: EventOptions,
    cb: Callback<RemovedSharedMember>
  ): void;

  once(event: "ResetExclusiveMember", cb: Callback<ResetExclusiveMember>): void;
  once(
    event: "ResetExclusiveMember",
    options: EventOptions,
    cb: Callback<ResetExclusiveMember>
  ): void;

  once(event: "Transfer", cb: Callback<Transfer>): void;
  once(event: "Transfer", options: EventOptions, cb: Callback<Transfer>): void;
}
