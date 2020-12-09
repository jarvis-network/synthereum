import Web3 from 'web3';
import {
  Network,
  ToNetworkName,
  toNetworkName,
  ValueOnNetwork,
} from '../eth/networks';
import { env } from '../config';
import type { Web3On } from '../eth/web3-instance';

enum Protocol {
  wss = 'wss:',
  https = 'https:',
}

export function getInfuraEndpoint<Net extends Network>(
  network: Net,
  protocol: Protocol = Protocol.https,
): ValueOnNetwork<string, Net> {
  const networkName = toNetworkName(network);
  const projectId = env.infuraProjectId;
  return `${protocol}//${networkName}.infura.io/v3/${projectId}` as ValueOnNetwork<
    string,
    Net
  >;
}

export function getInfuraWeb3<Net extends Network>(
  network: Net,
  protocol: Protocol = Protocol.https,
): Web3On<Net> {
  const url = getInfuraEndpoint(network);
  const result =
    protocol === Protocol.https
      ? new Web3(new Web3.providers.HttpProvider(url))
      : new Web3(new Web3.providers.WebsocketProvider(url));
  return result as Web3On<Net>;
}
