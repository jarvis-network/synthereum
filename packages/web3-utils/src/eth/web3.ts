import type { EventEmitter } from 'events';
import BN from 'bn.js';
import Web3 from 'web3';
import { toBN, toWei } from 'web3-utils';
import { PromiEvent, TransactionReceipt } from 'web3-core';
import {
  getContractAbi,
  getContractTxs,
  getEthUsdBtcPrice,
} from '../apis/etherscan';
import { fromBNToDecimalString } from '../base/big-number';
import { assertIsFiniteNumber, assertIsString } from '../base/asserts';
import type {
  NonPayableTransactionObject,
  BaseContract,
} from '../contracts/types';
import { getWeb3, Web3Source } from '../eth/web3-instance';

export type AbiSource =
  | {
      type: 'etherscan';
    }
  | {
      type: 'build-artifact';
      contractName: string;
    }
  | {
      type: 'direct';
      abi: {};
    };

export function getContractAbiFromArtifacts(
  contractName: string,
  relativePath?: string,
) {
  if (relativePath) {
    return require(`${relativePath}/${contractName}.json`);
  }
  return require(
    `../../../packages/contracts/build/contracts/${contractName}.json`,
  ).abi;
}

export async function getContract<T extends BaseContract>(
  address: string,
  web3OrNetwork: Web3Source = 'mainnet',
  abiSource: AbiSource = { type: 'etherscan' },
  gas?: {
    gasLimit: number;
    gasPrice: string;
  },
): Promise<T> {
  const web3 = getWeb3(web3OrNetwork);
  let abi: any = null;
  if (abiSource.type === 'direct') {
    abi = abiSource.abi;
  } else if (abiSource.type === 'etherscan') {
    abi = await getContractAbi(address);
  } else {
    abi = getContractAbiFromArtifacts(abiSource.contractName);
  }
  return (new web3.eth.Contract(abi, address, {
    gas: gas?.gasLimit,
    gasPrice: gas?.gasPrice,
  }) as unknown) as T;
}

export async function getContractTransactions(
  address: string,
  web3OrNetwork: Web3Source = 'mainnet',
) {
  const web3 = getWeb3(web3OrNetwork);
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
        promiEvent.once(type, () => resolve());
        break;
      case 'sent':
        promiEvent.once(type, () => resolve());
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
            resolve([confirmations, receipt, blockHash]);
            ((promiEvent as unknown) as EventEmitter).off(
              'confirmation',
              onConfirm,
            );
          }
        }

        promiEvent.on(type, onConfirm);
        break;
    }
  });
}

export async function logTransactionStatus<T>(
  web3: Web3,
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

export type TxObjFeeEstimator = <T>(
  txObj: NonPayableTransactionObject<T>,
) => Promise<{ allowance: number; gas?: number; feeEth?: BN; feeUsd?: string }>;

export interface FeeEstimation {
  gasLimit: number;
  gasPriceGwei: string;
  usdEthRate: string;
  maxFeeEth: string;
  maxFeeUsd: string;
  usdEthPriceTimestamp: Date;
  estimateFeesForTx: TxObjFeeEstimator;
}

export async function estimateFee(
  contract: BaseContract,
): Promise<FeeEstimation> {
  const { gas : gas_, gasPrice: gasPrice_ } = contract.options;
  const gas = assertIsFiniteNumber(gas_);
  const gasPrice = assertIsString(gasPrice_);
  const gasPriceBn = toBN(gasPrice);
  const maxFeeWei = toBN(assertIsFiniteNumber(gas)).mul(gasPriceBn);
  const { ethusd, ethusd_timestamp } = await getEthUsdBtcPrice();
  const ethUsdBn = toBN(toWei(ethusd));
  const maxFeeEth = fromBNToDecimalString(maxFeeWei);
  const maxFeeUsd = fromBNToDecimalString(
    maxFeeWei.mul(ethUsdBn).div(toBN(1e18)),
  );
  return {
    gasLimit: gas,
    gasPriceGwei: `${Number.parseFloat(gasPrice) / 1e9} Gwei`,
    usdEthRate: ethusd,
    maxFeeEth,
    maxFeeUsd,
    usdEthPriceTimestamp: new Date(Number.parseInt(ethusd_timestamp) * 1000),
    estimateFeesForTx: async <T>(txObj: NonPayableTransactionObject<T>) => {
      try {
        const gas = await txObj.estimateGas();
        const feeEth = toBN(gas).mul(gasPriceBn);
        return {
          allowance: gas,
          gas,
          feeEth,
          feeUsd: fromBNToDecimalString(feeEth.mul(ethUsdBn)),
        };
      } catch (err) {
        return { allowance: gas };
      }
    },
  };
}
