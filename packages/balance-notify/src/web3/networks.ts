export const networkNames = {
  1: 'mainnet',
  3: 'ropsten',
  4: 'rinkeby',
  5: 'goerli',
  42: 'kovan',
} as const;

export type NetworkId = keyof typeof networkNames;
export type NetworkName = typeof networkNames[NetworkId];
export type Network = NetworkId | NetworkName;
