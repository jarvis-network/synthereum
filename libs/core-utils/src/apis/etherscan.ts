import { encode } from 'querystring';

import axios from 'axios';
import type { BlockNumber } from 'web3-core';
import type { AbiItem } from 'web3-utils';

import { env } from '../config';
import { AddressOn } from '../eth/address';
import { NetworkName } from '../eth/networks';

export interface EtherscanTxInfo {
  blockNumber: string;
  timeStamp: string;
  hash: string;
  nonce: string;
  blockHash: string;
  from: string;
  contractAddress: string;
  to: string;
  value: string;
  tokenName: string;
  tokenSymbol: string;
  tokenDecimal: string;
  transactionIndex: string;
  gas: string;
  gasPrice: string;
  gasUsed: string;
  cumulativeGasUsed: string;
  input: string;
  confirmations: string;
}

export function getContractTxs<Net extends NetworkName>(
  contract: AddressOn<Net>,
  startBlock: BlockNumber = 0,
  endBlock: BlockNumber = 'latest',
): Promise<EtherscanTxInfo[]> {
  return makeEtherscanApiCall<EtherscanTxInfo[], Net>({
    module: 'account',
    action: 'tokentx',
    contractaddress: contract,
    startblock: startBlock.toString(),
    endblock: endBlock.toString(),
    sort: 'asc',
  });
}

interface SourceCodeResult<Net extends NetworkName> {
  ABI: string; // AbiItem[]
  CompilerVersion: string;
  ConstructorArguments: string;
  ContractName: string;
  EVMVersion: 'Default' | string;
  Implementation: '' | AddressOn<Net>;
  Library: '' | string;
  LicenseType: '' | string;
  OptimizationUsed: '0' | '1';
  Proxy: '0' | '1';
  Runs: string;
  SourceCode: string;
  SwarmSource: string;
}

export function getContractSourceCode<Net extends NetworkName>(
  contract: AddressOn<Net>,
): Promise<SourceCodeResult<Net>> {
  return makeEtherscanApiCall<SourceCodeResult<Net>, Net>({
    module: 'contract',
    action: 'getsourcecode',
    address: contract,
  });
}

export async function getContractAbi<Net extends NetworkName>(
  contract: AddressOn<Net>,
): Promise<AbiItem[]> {
  return JSON.parse(
    await makeEtherscanApiCall<string, Net>({
      module: 'contract',
      action: 'getabi',
      address: contract,
    }),
  ) as AbiItem[];
}

interface EtherscanPriceResult {
  ethbtc: string; // e.g. '0.0247'
  ['ethbtc_timestamp']: string; // e.g. '1592638994'
  ethusd: string; // e.g. '229.83'
  ['ethusd_timestamp']: string; // e.g. '1592638990'
}

export function getEthUsdBtcPrice<
  Net extends NetworkName,
>(): Promise<EtherscanPriceResult> {
  return makeEtherscanApiCall<EtherscanPriceResult, Net>({
    module: 'stats',
    action: 'ethprice',
  });
}

interface EtherscanApiResult<R> {
  status: string;
  message: string;
  error?:
    | string
    | {
        message: string;
      };
  result: string | R;
}

async function makeEtherscanApiCall<R, Net extends NetworkName>(
  query: {
    apikey?: string;
    module: string;
    action: string;
    [other: string]: string | string[] | undefined;
  },
  networkName: Net = 'mainnet' as Net,
) {
  query.apikey ??= env.apiKeys.etherscan;
  const queryString = encode(query);
  const netPrefix = networkName === 'mainnet' ? '' : `-${networkName}`;
  const url = `https://api${netPrefix}.etherscan.io/api?${queryString}`;
  const { data, status } = await axios.get<EtherscanApiResult<R>>(url);

  if (((status / 100) | 0) !== 2) {
    throw new Error(
      `Etherscan API Request failed with HTTP status: '${status}'`,
    );
  }

  if (data.status !== '1' || data.error) {
    let errorMessage;
    if (typeof data.result === 'string') {
      errorMessage = data.result;
    } else if (typeof data.message === 'string') {
      errorMessage = data.message;
    } else if (data.error) {
      errorMessage =
        typeof data.error === 'object' ? data.error.message : data.error;
    } else {
      errorMessage = 'Unknown error';
    }
    throw new Error(errorMessage);
  }

  return data.result as R;
}
