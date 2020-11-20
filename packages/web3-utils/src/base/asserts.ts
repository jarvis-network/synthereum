import { isAddress } from 'web3-utils';

export function isString(x: unknown): x is string {
  return typeof x === 'string';
}

export function isNumber(x: unknown): x is number {
  return typeof x === 'number';
}

export function isInteger(x: unknown): x is number {
  return Number.isInteger(x);
}

export function isFinite(x: unknown): x is number {
  return Number.isFinite(x);
}

export function isBoolean(x: unknown): x is boolean {
  return x === true || x === false;
}

export function assertIsString(x: unknown, minLength = 1): string {
  return isString(x) && x.length >= minLength
    ? x
    : throwError(
        `value=${x} is not a string of at least ${minLength} characters.`,
      );
}

export function assertIsNumber(x: unknown): number {
  return typeof x === 'number' ? x : throwError(`value=${x} is not a number.`);
}

export function coerceToFiniteFloatOrUndefined(x: unknown): number | undefined {
  return x == void 0 ? undefined : parseFiniteFloat(x);
}

export function coerceToIntegerOrUndefined(x: unknown): number | undefined {
  return x == void 0 ? undefined : parseInteger(x);
}

export function assertIsFiniteNumber(x: unknown): number {
  return isFinite(x) ? x : throwError(`value='${x}' is not a finite number.`);
}

export function parseFiniteFloat(x: unknown): number {
  const result = isNumber(x) ? x : Number.parseFloat(assertIsString(x));
  return assertIsFiniteNumber(result);
}

export function parseInteger(x: unknown): number {
  const result = isNumber(x) ? x : Number.parseFloat(assertIsString(x));
  if (!isInteger(result)) throwError(`value='${x}' is not an integer.`);
  return result;
}

type Object = { [prop: string]: unknown } & { [prop: number]: unknown };

export function isObject(x: unknown): x is object {
  return typeof x === 'object' && x !== null;
}

export function assertIsObject(x: unknown): Object {
  return isObject(x)
    ? (x as Object)
    : throwError(`'${JSON.stringify(x)}' is not an object.`);
}

export function assertIsBoolean(x: unknown): boolean {
  return isBoolean(x) ? x : throwError(`value='${x}' is not boolean.`);
}

export function isAddressZero(address: string) {
  return /^(0x)?0{40}$/.test(address);
}

export function assertIsAddress(x: unknown): string {
  return isString(x) && isAddress(x)
    ? x
    : throwError(`value='${x}' is not a valid Ethereum address.`);
}

export function assertIsArray(x: unknown): unknown[] {
  return Array.isArray(x)
    ? x
    : throwError(`'${JSON.stringify(x)}' is not an array.`);
}

export function throwError(message: string): never {
  throw new Error(message);
}
