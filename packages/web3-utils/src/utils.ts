import BN from 'bn.js';
import { fromWei, isAddress } from 'web3-utils';
import path from 'path';

export function loadJSON(filePath: string) {
    return require(path.resolve(__dirname, filePath));
}

export function fromBNToDecimalString(bn: BN) {
    return fromWei(bn);
}

export function assertIsAddress(val: unknown): string {
    const str = assertIsString(val);
    if (!isAddress(str))
      throw new Error(`value='${str}' is not a valid Ethereum address.`);
    return str;
}
  

export function assertIsString(val: unknown, minLength = 1): string {
    if (typeof val !== 'string' || val.length < minLength) {
      throw new Error(
        `value=${JSON.stringify(
          val,
        )} is not a string of at least ${minLength} characters.`,
      );
    }
    return val;
}
  