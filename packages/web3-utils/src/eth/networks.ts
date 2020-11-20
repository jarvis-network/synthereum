import { isInteger, isString } from '../base/asserts';
import type { InverseOf } from '../base/meta';

export const networkIdToName = {
  1: 'mainnet',
  3: 'ropsten',
  4: 'rinkeby',
  5: 'goerli',
  42: 'kovan',
} as const;

export const networkNameToId: InverseOf<typeof networkIdToName> = {
  'mainnet': 1,
  'ropsten': 3,
  'rinkeby': 4,
  'goerli': 5,
  'kovan': 42,
} as const;

export type NetworkId = keyof typeof networkIdToName;
export type NetworkName = typeof networkIdToName[NetworkId];
export type Network = NetworkId | NetworkName;

export function isNetworkId(x: unknown): x is NetworkId {
  return isInteger(x) && x in networkIdToName;
}

export function isNetworkName(x: unknown): x is NetworkName {
  return isString(x) && x in networkNameToId;
}

export function toNetworkId(network: Network): NetworkId {
  return isNetworkName(network)
    ? networkNameToId[network]
    : network;
}

export function toNetworkName(network: Network): NetworkName {
  return isNetworkId(network)
    ? networkIdToName[network]
    : network;
}
