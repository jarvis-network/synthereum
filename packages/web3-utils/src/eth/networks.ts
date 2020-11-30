import { assert, isInteger, isString } from '../base/asserts';
import type { InverseOf, KeysToKeys } from '../base/meta';

export const networkIdToName = {
  1: 'mainnet',
  3: 'ropsten',
  4: 'rinkeby',
  5: 'goerli',
  42: 'kovan',
} as const;

export const networkNameToId: InverseOf<typeof networkIdToName> = {
  mainnet: 1,
  ropsten: 3,
  rinkeby: 4,
  goerli: 5,
  kovan: 42,
} as const;

export type NetworkId = keyof typeof networkIdToName;
export type NetworkName = typeof networkIdToName[NetworkId];
export type Network = NetworkId | NetworkName;

const networkIdToId: KeysToKeys<typeof networkIdToName> = {
  1: 1,
  3: 3,
  4: 4,
  5: 5,
  42: 42,
};

const networkNameToName: KeysToKeys<typeof networkNameToId> = {
  mainnet: 'mainnet',
  ropsten: 'ropsten',
  rinkeby: 'rinkeby',
  goerli: 'goerli',
  kovan: 'kovan',
};

export function isNetworkId(x: unknown): x is NetworkId {
  return isInteger(x) && x in networkIdToName;
}

export function assertIsNetworkId(x: unknown): NetworkId {
  assert(isNetworkId(x));
  return x;
}

export function isNetworkName(x: unknown): x is NetworkName {
  return isString(x) && x in networkNameToId;
}

export function assertIsNetworkName(x: unknown): NetworkName {
  assert(isNetworkName(x));
  return x;
}

export type ToNetworkName<Net extends Network> = (typeof networkIdToName &
  typeof networkNameToName)[Net];
export type ToNetworkId<Net extends Network> = (typeof networkNameToId &
  typeof networkIdToId)[Net];

export function toNetworkId<Id extends NetworkId>(id: Id): Id;
export function toNetworkId<Name extends NetworkName>(
  network: Name,
): ToNetworkId<Name>;
export function toNetworkId(network: Network): NetworkId;
export function toNetworkId(network: Network): NetworkId {
  return isNetworkName(network) ? networkNameToId[network] : network;
}

export function toNetworkName<Name extends NetworkName>(network: Name): Name;
export function toNetworkName<Id extends NetworkId>(
  id: Id,
): ToNetworkName<Id>;
export function toNetworkName(network: Network): NetworkName;
export function toNetworkName(network: Network): NetworkName {
  return isNetworkId(network) ? networkIdToName[network] : network;
}
