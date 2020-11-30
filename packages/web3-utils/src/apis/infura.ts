import Web3 from 'web3';
import {
  Network,
  ToNetworkName,
  toNetworkName,
} from '../eth/networks';
import { env } from '../config';
import { Tagged } from '../base/tagged-type';

enum Protocol {
  wss = 'wss:',
  https = 'https:',
}

export function getInfuraEndpoint<Net extends Network>(
  network: Net,
  protocol: Protocol = Protocol.https,
): Tagged<string, ToNetworkName<Net>> {
  const networkName = toNetworkName(network);
  const projectId = env.infuraProjectId;
  return `${protocol}//${networkName}.infura.io/v3/${projectId}` as Tagged<
    string,
    ToNetworkName<Net>
  >;
}

export function getInfuraWeb3<Net extends Network>(
  network: Net,
  protocol: Protocol = Protocol.https,
) {
  const url = getInfuraEndpoint(network);
  const result =
    protocol === Protocol.https
      ? new Web3(new Web3.providers.HttpProvider(url))
      : new Web3(new Web3.providers.WebsocketProvider(url));
  return result as Tagged<Web3, ToNetworkName<Net>>;
}
