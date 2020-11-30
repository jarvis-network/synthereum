import { isAddress as isAddress_ } from 'web3-utils';
import { isString, throwError } from '../base/asserts';
import { NetworkName } from './networks';
import { Tagged } from '../base/tagged-type';

export type Address = Tagged<string, 'EthereumAddress'>;
export type AddressOn<Net extends NetworkName> = Tagged<Address, Net>;

export function isAddress(x: string): x is Address {
  return isAddress_(x);
}

export function isAddressZero(address: string): address is Address {
  return /^(0x)?0{40}$/.test(address);
}

export function assertIsAddress(x: unknown): Address {
  return isString(x) && isAddress(x)
    ? x
    : throwError(`value='${x}' is not a valid Ethereum address.`);
}
