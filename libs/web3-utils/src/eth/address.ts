import { isAddress as isAddress_ } from 'web3-utils';

import { isString, throwError } from '../base/asserts';

import { Tagged } from '../base/tagged-type';

import { Network, ValueOnNetwork } from './networks';

export type Address = Tagged<string, 'EthereumAddress'>;
export type AddressOn<Net extends Network | undefined> = Net extends Network
  ? ValueOnNetwork<Address, Net>
  : Address;

export function isAddress<Net extends Network | undefined = undefined>(
  x: string,
): x is AddressOn<Net> {
  return isAddress_(x);
}

export function isAddressZero<Net extends Network | undefined = undefined>(
  address: string,
): address is AddressOn<Net> {
  return /^(0x)?0{40}$/.test(address);
}

export function assertIsAddress<Net extends Network | undefined = undefined>(
  x: unknown,
): AddressOn<Net> {
  return isString(x) && isAddress<Net>(x)
    ? x
    : throwError(`value='${x}' is not a valid Ethereum address.`);
}
