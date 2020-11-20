import { isAddress } from 'web3-utils';

export function isString(x: unknown): x is string {
  return typeof x === 'string';
}

export function isInteger(x: unknown): x is number {
  return Number.isInteger(x);
}

export function assertIsAddress(x: unknown): string {
  return isString(x) && isAddress(x)
    ? x
    : throwError(`value='${x}' is not a valid Ethereum address.`);
}

export function assertIsString(x: unknown, minLength = 1): string {
  return isString(x) && x.length >= minLength
    ? x
    : throwError(
        `value=${x} is not a string of at least ${minLength} characters.`,
      );
}

export function throwError(message: string): never {
  throw new Error(message);
}
