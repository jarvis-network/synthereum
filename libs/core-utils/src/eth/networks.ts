import {
  isInteger,
  isNumericString,
  isString,
  parseInteger,
  throwError,
} from '../base/asserts';
import type { InverseOf, KeysToKeys } from '../base/meta';
import { Tagged } from '../base/tagged-type';

export const networkIdToName = {
  1: 'mainnet',
  3: 'ropsten',
  4: 'rinkeby',
  5: 'goerli',
  42: 'kovan',
  137: 'polygon',
  80001: 'mumbai',
  31337: 'hardhat',
  56: 'bsc',
  97: 'bscTestnet',
  77: 'sokol',
} as const;

export const networkNameToId: InverseOf<typeof networkIdToName> = {
  mainnet: 1,
  ropsten: 3,
  rinkeby: 4,
  goerli: 5,
  kovan: 42,
  polygon: 137,
  mumbai: 80001,
  hardhat: 31337,
  bsc: 56,
  bscTestnet: 97,
  sokol: 77,
} as const;

export type NetworkId = keyof typeof networkIdToName;
export type NetworkName = typeof networkIdToName[NetworkId];
export type Network = NetworkId | NetworkName;

export const Network = { ...networkIdToName, ...networkNameToId };

export type ValueOnNetwork<Value, Net extends Network> = Tagged<
  Value,
  { network: ToNetworkName<Net> }
>;

const networkIdToId: KeysToKeys<typeof networkIdToName> = {
  1: 1,
  3: 3,
  4: 4,
  5: 5,
  42: 42,
  137: 137,
  80001: 80001,
  31337: 31337,
  56: 56,
  97: 97,
  77: 77,
};

const networkNameToName: KeysToKeys<typeof networkNameToId> = {
  mainnet: 'mainnet',
  ropsten: 'ropsten',
  rinkeby: 'rinkeby',
  goerli: 'goerli',
  kovan: 'kovan',
  polygon: 'polygon',
  mumbai: 'mumbai',
  hardhat: 'hardhat',
  bsc: 'bsc',
  bscTestnet: 'bscTestnet',
  sokol: 'sokol',
};

export function isNetworkId(x: unknown): x is NetworkId {
  return isInteger(x) && x in networkIdToName;
}

export function assertIsNetworkId(x: unknown): NetworkId {
  return isNetworkId(x) ? x : throwError(`'${x}' is not a valid network id`);
}

export function isNetworkName(x: unknown): x is NetworkName {
  return isString(x) && x in networkNameToId;
}

export function assertIsNetworkName(x: unknown): NetworkName {
  return isNetworkName(x)
    ? x
    : throwError(`'${x}' is not a valid network name`);
}

export type ToNetworkName<Net extends Network> = (typeof networkIdToName &
  typeof networkNameToName)[Net];
export type ToNetworkId<Net extends Network> = (typeof networkNameToId &
  typeof networkIdToId)[Net];

export type NetworkNameNoFork<
  T extends NetworkName | `${NetworkName}_fork`
> = T extends `${infer Name}_fork` ? Name : T;

export function toNetworkId<Id extends NetworkId>(id: Id): Id;
export function toNetworkId<Name extends NetworkName | `${NetworkName}_fork`>(
  network: Name,
): ToNetworkId<NetworkNameNoFork<Name>>;
export function toNetworkId(network: Network): NetworkId;
export function toNetworkId(network: Network): NetworkId {
  if (typeof network === 'string') {
    if (network.endsWith('_fork')) {
      network = assertIsNetworkName(network.substring(0, network.length - 5));
    }
    return networkNameToId[network];
  }
  return assertIsNetworkId(network);
}
export function parseNetworkId(x: unknown): NetworkId {
  return typeof x === 'number' || isNumericString(x)
    ? assertIsNetworkId(parseInteger(x))
    : networkNameToId[assertIsNetworkName(x)];
}

export function toNetworkName<Name extends NetworkName>(network: Name): Name;
export function toNetworkName<Id extends NetworkId>(id: Id): ToNetworkName<Id>;
export function toNetworkName(network: Network): NetworkName;
export function toNetworkName(network: Network): NetworkName {
  return isNetworkId(network) ? networkIdToName[network] : network;
}
export function parseNetworkName(x: unknown): NetworkName {
  return (x as string) in networkNameToId
    ? (x as NetworkName)
    : networkIdToName[assertIsNetworkId(parseInteger(x))];
}
