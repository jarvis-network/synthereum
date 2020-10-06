import Web3 from 'web3';
import { isNumber } from 'lodash';
import { networkNames, Network } from '../networks';
import { env } from '../config';

export function getInfuraEndpoint(network: Network) {
  const networkName = isNumber(network) ? networkNames[network] : network;
  const projectId = env.apiKeys.infura;
  return `https://${networkName}.infura.io/v3/${projectId}`;
}

export function getInfuraWeb3(network: Network): Web3 {
  const url = getInfuraEndpoint(network);
  return new Web3(new Web3.providers.HttpProvider(url));
}
