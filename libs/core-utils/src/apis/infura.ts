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
  const subdomain =
    networkName === 'polygon'
      ? 'polygon-mainnet'
      : networkName === 'mumbai'
      ? 'polygon-mumbai'
      : networkName;
  return `${protocol}://${subdomain}.infura.io${
    protocol === 'wss' ? '/ws' : ''
  }/v3/${projectId}` as ValueOnNetwork<string, Net>;
}

export function getInfuraWeb3<Net extends Network>(
  network: Net,
  protocol: Protocol = 'https',
  projectId = env.infuraProjectId,
): Web3On<Net> {
  const url = getInfuraEndpoint(network, protocol, projectId);
  const result =
    protocol === 'https'
      ? new Web3(new Web3.providers.HttpProvider(url))
      : new Web3(new Web3.providers.WebsocketProvider(url));
  return result as Web3On<Net>;
}
