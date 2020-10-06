import axios from 'axios';
import { encode, ParsedUrlQueryInput } from 'querystring';
import type { BlockNumber } from 'web3-core/types';
import { AbiItem } from 'web3-utils';
import { env } from '../config';
import { assertIsAddress } from '../utils';

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

export async function getContractTxs(
  contractAddress: string,
  startBlock: BlockNumber = 0,
  endBlock: BlockNumber = 'latest',
) {
  const query = {
    module: 'account',
    action: 'tokentx',
    contractaddress: assertIsAddress(contractAddress),
    startblock: startBlock.toString(),
    endblock: endBlock.toString(),
    sort: 'asc',
  };
  const result = await makeEtherscanApiCall(query);
  return result as EtherscanTxInfo[];
}

export async function getContractAbi(contract: string) {
  const query = {
    module: 'contract',
    action: 'getabi',
    address: assertIsAddress(contract),
  };
  const result = await makeEtherscanApiCall(query);
  return JSON.parse(result) as AbiItem[];
}

interface EtherscanPriceResult {
  ethbtc: string; // e.g. '0.0247'
  ethbtc_timestamp: string; // e.g. '1592638994'
  ethusd: string; // e.g. '229.83'
  ethusd_timestamp: string; // e.g. '1592638990'
}

export async function getEthUsdBtcPrice() {
  const query = {
    module: 'stats',
    action: 'ethprice',
  };
  const result = await makeEtherscanApiCall(query);
  return result as EtherscanPriceResult;
}

async function makeEtherscanApiCall(
  query: ParsedUrlQueryInput,
  apikey?: string,
) {
  apikey = apikey ?? env.apiKeys.etherscan;
  query = { ...query, apikey };
  const queryString = encode(query);
  const url = `https://api.etherscan.io/api?${queryString}`;
  const response = await axios.get(url);
  const data = response.data;

  if (data.status && data.status != 1) {
    let returnMessage = data.message || 'NOTOK';
    if (data.result && typeof data.result === 'string') {
      returnMessage = data.result;
    } else if (data.message && typeof data.message === 'string') {
      returnMessage = data.message;
    }
    throw new Error(returnMessage);
  } else if (data.error) {
    let message = data.error;
    if (typeof data.error === 'object' && data.error.message) {
      message = data.error.message;
    }
    throw new Error(message);
  }

  return data.result;
}
