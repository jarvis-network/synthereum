import Web3 from 'web3';
import { Network, toNetworkName } from '../eth/networks';
import { env } from '../config';

enum Protocol {
  wss = "wss:",
  https = "https:"
}

export function getInfuraEndpoint(network: Network, protocol: Protocol = Protocol.https) {
  const networkName = toNetworkName(network);
  const projectId = env.infuraProjectId;
  return `${protocol}//${networkName}.infura.io/v3/${projectId}`;
}

export function getInfuraWeb3(network: Network, protocol: Protocol = Protocol.https): Web3 {
  const url = getInfuraEndpoint(network);
  return protocol === Protocol.https
    ? new Web3(new Web3.providers.HttpProvider(url))
    : new Web3(new Web3.providers.WebsocketProvider(url));
}
