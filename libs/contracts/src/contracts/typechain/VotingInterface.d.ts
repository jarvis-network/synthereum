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

export interface VotingInterface extends BaseContract {
  constructor(
    jsonInterface: any[],
    address?: string,
    options?: ContractOptions
  ): VotingInterface;
  clone(): VotingInterface;
  methods: {
    /**
     * `identifier`, `time` must correspond to a price request that's currently in the commit phase. Commits can be changed.Since transaction data is public, the salt will be revealed with the vote. While this is the system’s expected behavior, voters should never reuse salts. If someone else is able to guess the voted price and knows that a salt will be reused, then they can determine the vote pre-reveal.
     * Commit a vote for a price request for `identifier` at `time`.
     * @param hash keccak256 hash of the `price`, `salt`, voter `address`, `time`, current `roundId`, and `identifier`.
     * @param identifier uniquely identifies the committed vote. EG BTC/USD price pair.
     * @param time unix timestamp of the price being voted on.
     */
    commitVote(
      identifier: string | number[],
      time: number | string,
      hash: string | number[]
    ): NonPayableTransactionObject<void>;

    batchCommit(
      commits: [
        string | number[],
        number | string,
        string | number[],
        string | number[]
      ][]
    ): NonPayableTransactionObject<void>;

    /**
     * An encrypted version of the vote is emitted in an event `EncryptedVote` to allow off-chain infrastructure to retrieve the commit. The contents of `encryptedVote` are never used on chain: it is purely for convenience.
     * commits a vote and logs an event with a data blob, typically an encrypted version of the vote
     * @param encryptedVote offchain encrypted blob containing the voters amount, time and salt.
     * @param hash keccak256 hash of the price you want to vote for and a `int256 salt`.
     * @param identifier unique price pair identifier. Eg: BTC/USD price pair.
     * @param time unix timestamp of for the price request.
     */
    commitAndEmitEncryptedVote(
      identifier: string | number[],
      time: number | string,
      hash: string | number[],
      encryptedVote: string | number[]
    ): NonPayableTransactionObject<void>;

    /**
     * This function can be called multiple times but each round will only every have one snapshot at the time of calling `_freezeRoundVariables`.
     * snapshot the current round's token balances and lock in the inflation rate and GAT.
     * @param signature signature required to prove caller is an EOA to prevent flash loans from being included in the snapshot.
     */
    snapshotCurrentRound(
      signature: string | number[]
    ): NonPayableTransactionObject<void>;

    /**
     * The revealed `price`, `salt`, `address`, `time`, `roundId`, and `identifier`, must hash to the latest `hash` that `commitVote()` was called with. Only the committer can reveal their vote.
     * Reveal a previously committed vote for `identifier` at `time`.
     * @param identifier voted on in the commit phase. EG BTC/USD price pair.
     * @param price voted on during the commit phase.
     * @param salt value used to hide the commitment price during the commit phase.
     * @param time specifies the unix timestamp of the price is being voted on.
     */
    revealVote(
      identifier: string | number[],
      time: number | string,
      price: number | string,
      salt: number | string
    ): NonPayableTransactionObject<void>;

    batchReveal(
      reveals: [
        string | number[],
        number | string,
        number | string,
        number | string
      ][]
    ): NonPayableTransactionObject<void>;

    /**
     * Gets the queries that are being voted on this round.
     */
    getPendingRequests(): NonPayableTransactionObject<
      [string, string, string][]
    >;

    /**
     * Returns the current voting phase, as a function of the current time.
     */
    getVotePhase(): NonPayableTransactionObject<string>;

    /**
     * Returns the current round ID, as a function of the current time.
     */
    getCurrentRoundId(): NonPayableTransactionObject<string>;

    retrieveRewards(
      voterAddress: string,
      roundId: number | string,
      toRetrieve: [string | number[], number | string][]
    ): NonPayableTransactionObject<[string]>;

    /**
     * Can only be called by the contract owner.
     * Disables this Voting contract in favor of the migrated one.
     * @param newVotingAddress the newly migrated contract address.
     */
    setMigrated(newVotingAddress: string): NonPayableTransactionObject<void>;

    setInflationRate(
      newInflationRate: [number | string]
    ): NonPayableTransactionObject<void>;

    setGatPercentage(
      newGatPercentage: [number | string]
    ): NonPayableTransactionObject<void>;

    /**
     * This change only applies to rounds that have not yet begun.
     * Resets the rewards expiration timeout.
     * @param NewRewardsExpirationTimeout how long a caller can wait before choosing to withdraw their rewards.
     */
    setRewardsExpirationTimeout(
      NewRewardsExpirationTimeout: number | string
    ): NonPayableTransactionObject<void>;
  };
  events: {
    allEvents(options?: EventOptions, cb?: Callback<EventLog>): EventEmitter;
  };
}
