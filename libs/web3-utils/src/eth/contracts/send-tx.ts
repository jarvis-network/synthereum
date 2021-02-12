import type { EventEmitter } from 'events';
import type { PromiEvent, TransactionReceipt } from 'web3-core';
import type { AddressOn } from '../address';
import type { NetworkName, ToNetworkId } from '../networks';
import { Web3On } from '../web3-instance';
import { logTransactionOutput, TxLogParams } from './print-tx';
import type {
  NonPayableTransactionObject,
  NonPayableTx,
} from './typechain/types';

export interface TxOptions {
  nonce?: number;
  gasLimit?: number;
  gasPrice?: number;
  printInfo?: Omit<TxLogParams, 'txhash'>;
}

export interface FullTxOptions<Net extends NetworkName> extends TxOptions {
  web3: Web3On<Net>;
  from: AddressOn<Net>;
  chainId?: ToNetworkId<Net>;
}

const nonces: Record<string, number> = {};

export async function sendTx<Result, Net extends NetworkName>(
  tx: NonPayableTransactionObject<Result>,
  { web3, gasLimit, nonce, from, printInfo, ...rest }: FullTxOptions<Net>,
): Promise<TransactionReceipt> {
  // If no logging function is provided, default to noop:
  const log = printInfo?.log ?? (() => {});

  log('Getting tx nonce', { userSpecifiedNonce: nonce });
  if (!nonces[from]) {
    const newNonce = nonce ?? (await web3.eth.getTransactionCount(from));
    // In an async environment another "fiber" of execution may resolve the
    // promise above before us. Use the double-checked locking pattern (kind
    // of), to prevent overwrite in case we're late:
    if (!nonces[from]) {
      nonces[from] = newNonce;
    }
  }
  nonce = nonces[from]++;
  log('Using nonce:', nonce, { nextNonces: nonces });

  const txParams: NonPayableTx = {
    ...rest,
    from,
    nonce,
  };

  log(
    `Gas estimation for '${printInfo?.txSummaryText}' tx:`,
    tx.arguments,
    txParams,
  );
  const estimatedGas = await tx.estimateGas(txParams);

  gasLimit ??= estimatedGas;
  (txParams.gas = estimatedGas < gasLimit ? estimatedGas : gasLimit),
    log('Setting gasLimit: ', txParams.gas);

  log(`Sending '${printInfo?.txSummaryText}' tx:`, tx.arguments, txParams);
  const txReceipt = await logTransactionStatus(web3, tx.send(txParams), log);

  if (printInfo) {
    await logTransactionOutput({
      ...printInfo,
      txhash: txReceipt.transactionHash,
      web3,
    });
  }

  return txReceipt;
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
  log = console.log,
) {
  await once(promiEvent, 'sending');
  log('  [1/4] Sending tx...');

  await once(promiEvent, 'sent');
  log('  [2/4] Tx sent. Waiting for hash...');

  const txHash = await once(promiEvent, 'transactionHash');
  log(
    `  [3/4]: Tx hash: '${txHash}'. Waiting for ${web3.eth.transactionConfirmationBlocks} confirmations...`,
  );

  const [confirmation, receipt] = await once(
    promiEvent,
    'confirmation',
    web3.eth.transactionConfirmationBlocks,
  );
  const { gasUsed, blockNumber } = receipt;
  log(
    `  [4/4]: Tx confirmed ${confirmation} time(s). Gas used: ${gasUsed} | block number: ${blockNumber}`,
  );

  return receipt;
}
