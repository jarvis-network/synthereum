import type { BlockNumber, Transaction } from 'web3-core';
import { getContractTxs } from '../apis/etherscan';
import { parseInteger } from '../base/asserts';
import { NetworkName, Web3On } from './web3-instance';
import { asyncLowerBound } from '../base/sorting';
import { AddressOn } from './address';

export async function getBlockTimestamp<Net extends NetworkName>(
  web3: Web3On<Net>,
  blockNumber: BlockNumber,
): Promise<number> {
  return parseInteger((await web3.eth.getBlock(blockNumber)).timestamp);
}

/**
 * Finds the last block number in the range `[startTime, endTime)`, using
 * binary search, where `startTime` is the timestamp of the `startBlock`
 * parameter.
 *
 * @param web3 Web3 instance
 * @param startBlock block number from which to start searching
 * @param endingTimestamp
 */
export async function getClosestBlock<Net extends NetworkName>(
  web3: Web3On<Net>,
  startBlock: number,
  endingTimestamp: number,
): Promise<number> {
  return asyncLowerBound({
    isLessThanAt: blockNumber =>
      getBlockTimestamp(web3, blockNumber).then(t => t < endingTimestamp),
    getStartIndex: () => Promise.resolve(startBlock),
    getEndIndex: () => web3.eth.getBlockNumber(),
  });
}

export async function getContractTransactions<Net extends NetworkName>(
  web3: Web3On<Net>,
  address: AddressOn<Net>,
): Promise<Transaction[]> {
  return await Promise.all(
    (await getContractTxs(address)).map(
      async tx => await web3.eth.getTransaction(tx.hash),
    ),
  );
}
