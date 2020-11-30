import { assert, isInteger, isString } from '../base/asserts';
import type { InverseOf } from '../base/meta';

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

export type NetworkIdToType<Id extends NetworkId> = typeof networkIdToName[Id];
export type NetworkNameToId<
  Name extends NetworkName
> = typeof networkNameToId[Name];

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

export function toNetworkId<Id extends NetworkId>(id: Id): Id;
export function toNetworkId<Name extends NetworkName>(
  network: Name,
): NetworkNameToId<Name>;
export function toNetworkId(network: Network): NetworkId;
export function toNetworkId(network: Network): NetworkId {
  return isNetworkName(network) ? networkNameToId[network] : network;
}

export function toNetworkName<Name extends NetworkName>(network: Name): Name;
export function toNetworkName<Id extends NetworkId>(
  id: Id,
): typeof networkIdToName[Id];
export function toNetworkName(network: Network): NetworkName;
export function toNetworkName(network: Network): NetworkName {
  return isNetworkId(network) ? networkIdToName[network] : network;
}
