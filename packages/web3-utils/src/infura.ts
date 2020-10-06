import Web3 from 'web3';
import { Network, networkNames } from './networks';

export type Web3Source = Web3 | Network;

export function getWeb3(web3OrNetwork: Web3Source): Web3 {
  return web3OrNetwork instanceof Web3
    ? web3OrNetwork
    : getInfuraWeb3(web3OrNetwork);
}

export function getInfuraWeb3(network: Network): Web3 {
  const url = getInfuraEndpoint(network);
  return new Web3(new Web3.providers.HttpProvider(url));
}

export function getInfuraEndpoint(network: Network) {
  const networkName =
    typeof network === 'number' ? networkNames[network] : network;
  const projectId = process.env.INFURA_KEY;
  return `https://${networkName}.infura.io/v3/${projectId}`;
}
