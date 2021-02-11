import type { AddressOn } from '../address';
import type { NetworkName, ToNetworkId } from '../networks';
import type { NonPayableTransactionObject } from './typechain/types';
import type { PromiEvent, TransactionReceipt } from 'web3-core';
import { EventEmitter } from 'events';
import { Web3On } from '../web3-instance';
import { printTruffleLikeTransactionOutput, PrintTxInfo } from './print-tx';

export type TxOptions<
  Net extends NetworkName,
  fromRequired extends boolean = false
> = {
  nonce?: number;
  chainId?: ToNetworkId<Net>;
  gasLimit?: number;
  gasPrice?: number;
  printInfo?: Omit<PrintTxInfo, 'txhash'>;
} & (fromRequired extends true ? { from: AddressOn<Net> } : {});

export async function sendTx<
  Result,
  Net extends NetworkName,
  hasSender extends boolean = false
>(
  tx: NonPayableTransactionObject<Result>,
  { gasLimit, printInfo, ...rest }: TxOptions<Net, hasSender>,
): Promise<TransactionReceipt> {
  const estimatedGas = await tx.estimateGas({
    ...rest,
  });
  gasLimit ??= estimatedGas;
  const result = await once(
    tx.send({
      ...rest,
      gas: estimatedGas < gasLimit ? estimatedGas : gasLimit,
    }),
    'confirmation',
  );

  const [_, txReceipt] = result;

  if (printInfo) {
    await printTruffleLikeTransactionOutput({
      ...printInfo,
      txhash: txReceipt.transactionHash,
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
