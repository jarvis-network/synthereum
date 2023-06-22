import Web3 from 'web3';

import { Network, toNetworkName, ValueOnNetwork } from '../eth/networks';
import { env } from '../config';
import type { Web3On } from '../eth/web3-instance';

export type Protocol = 'wss' | 'https';

export function getInfuraEndpoint<Net extends Network>(
  network: Net,
  protocol: Protocol = 'https',
  projectId = env.infuraProjectId,
): ValueOnNetwork<string, Net> {
  const networkName = toNetworkName(network);
  const infuraNetworkName =
    networkName === 'polygon'
      ? 'polygon-mainnet'
      : networkName === 'mumbai'
      ? 'polygon-mumbai'
      : networkName === 'optimismGoerli'
      ? 'optimism-goerli'
      : networkName === 'optimism'
      ? 'optimism-mainnet'
      : networkName;
  return `${protocol}://${infuraNetworkName}.infura.io${
    protocol === 'wss' ? '/ws' : ''
  }/v3/${projectId}` as ValueOnNetwork<string, Net>;
}

export function getBscEndpoint<Net extends Network>(
  network: Net,
  protocol: Protocol = 'https',
): ValueOnNetwork<string, Net> {
  const networkName = toNetworkName(network);
  const endpoint =
    networkName === 'bsc'
      ? `bsc-dataseed1.binance.org`
      : `data-seed-prebsc-1-s1.binance.org:8545`;
  return `${protocol}://${endpoint}` as ValueOnNetwork<string, Net>;
}

export function getXDAIEndpoint<Net extends Network>(
  network: Net,
  protocol: Protocol = 'https',
): ValueOnNetwork<string, Net> {
  const networkName = toNetworkName(network);
  const endpoint =
    networkName === 'gnosis' ? 'rpc.gnosis.gateway.fm' : 'sokol.poa.network';
  return `${protocol}://${endpoint}` as ValueOnNetwork<string, Net>;
}

export function getFantomTestnetEndpoint<Net extends Network>(
  network: Net,
  protocol: Protocol = 'https',
): ValueOnNetwork<string, Net> {
  const endpoint = 'rpc.testnet.fantom.network';
  return `${protocol}://${endpoint}` as ValueOnNetwork<string, Net>;
}

export function getFantomOperaEndpoint<Net extends Network>(
  network: Net,
  protocol: Protocol = 'https',
): ValueOnNetwork<string, Net> {
  const endpoint = 'rpc.ftm.tools';
  return `${protocol}://${endpoint}` as ValueOnNetwork<string, Net>;
}

export function getAvalancheEndpoint<Net extends Network>(
  network: Net,
  protocol: Protocol = 'https',
): ValueOnNetwork<string, Net> {
  const networkName = toNetworkName(network);
  const endpoint =
    networkName === 'avalanche'
      ? 'api.avax.network/ext/bc/C/rpc'
      : 'api.avax-test.network/ext/bc/C/rpc';
  return `${protocol}://${endpoint}` as ValueOnNetwork<string, Net>;
}

export function getInfuraWeb3<Net extends Network>(
  network: Net,
  protocol: Protocol = 'https',
): Web3On<Net> {
  const url = getInfuraEndpoint(network, protocol);
  const result =
    protocol === 'https'
      ? new Web3(new Web3.providers.HttpProvider(url))
      : new Web3(new Web3.providers.WebsocketProvider(url));
  return result as Web3On<Net>;
}
