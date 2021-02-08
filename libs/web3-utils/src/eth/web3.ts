import type { EventEmitter } from 'events';
import BN from 'bn.js';
import type {
  BlockNumber,
  PromiEvent,
  Transaction,
  TransactionReceipt,
} from 'web3-core';
import { getContractTxs } from '../apis/etherscan';
import { parseInteger } from '../base/asserts';
import type { NonPayableTransactionObject } from './contracts/typechain/types';
import { NetworkName, Web3On } from './web3-instance';
import { asyncLowerBound } from '../base/sorting';

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
  address: string,
): Promise<Transaction[]> {
  return await Promise.all(
    (await getContractTxs(address)).map(
      async tx => await web3.eth.getTransaction(tx.hash),
    ),
  );
}

export function once<T>(
  promiEvent: PromiEvent<T>,
  type: 'sending',
): Promise<void>;
export function once<T>(promiEvent: PromiEvent<T>, type: 'sent'): Promise<void>;
export function once<T>(
  promiEvent: PromiEvent<T>,
  type: 'transactionHash',
): Promise<string>;
export function once<T>(
  promiEvent: PromiEvent<T>,
  type: 'receipt',
): Promise<TransactionReceipt>;
export function once<T>(
  promiEvent: PromiEvent<T>,
  type: 'confirmation',
  maxConfirmations?: number,
): Promise<[number, TransactionReceipt, string]>;
export function once<T>(
  promiEvent: PromiEvent<T>,
  type: Parameters<typeof promiEvent.once>[0] | 'sending' | 'sent',
  maxConfirmations = 1,
) {
  return new Promise((resolve, reject) => {
    promiEvent.once('error', reject);
    switch (type) {
      case 'sending':
        promiEvent.once(type, resolve);
        break;
      case 'sent':
        promiEvent.once(type, resolve);
        break;
      case 'transactionHash':
      case 'receipt':
        promiEvent.once(type, resolve);
        break;
      case 'confirmation':
        function onConfirm(
          confirmations: number,
          receipt: TransactionReceipt,
          blockHash?: string,
        ) {
          if (confirmations == maxConfirmations) {
            ((promiEvent as unknown) as EventEmitter).off(
              'confirmation',
              onConfirm,
            );
            resolve([confirmations, receipt, blockHash]);
          }
        }

        promiEvent.on(type, onConfirm);
        break;
    }
  });
}

export async function logTransactionStatus<T, Net extends NetworkName>(
  web3: Web3On<Net>,
  promiEvent: PromiEvent<T>,
) {
  await once(promiEvent, 'sending');
  console.log('[1/4] Sending tx...');

  await once(promiEvent, 'sent');
  console.log('[2/4] Tx sent. Waiting for hash...');

  const txHash = await once(promiEvent, 'transactionHash');
  console.log(
    `[3/4]: Tx hash: '${txHash}'. Waiting for ${web3.eth.transactionConfirmationBlocks} confirmations...`,
  );

  const [confirmation, receipt] = await once(
    promiEvent,
    'confirmation',
    web3.eth.transactionConfirmationBlocks,
  );
  const { gasUsed, blockNumber } = receipt;
  console.log(
    `[4/4]: Tx confirmed ${confirmation} time(s). Gas used: ${gasUsed} | block number: ${blockNumber}`,
  );

  return receipt;
}
