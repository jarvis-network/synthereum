type AssertFunc = (value: any, message?: string) => asserts value;

export const assert: AssertFunc =
  process.env.app_env !== 'browser'
    ? require('assert').strict
    : (value: any, message?: string) => {
        if (!value) throw new Error(message);
      };

export function isString(x: unknown): x is string {
  return typeof x === 'string';
}

export function isNumericString(str: string) {
  return /^-?\d+$/.test(str);
}

export function assertIsNumericString(x: string): string {
  assert(isNumericString(x));
  return x;
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

export function assertNotNull<T>(x: T | null | undefined): T {
  assert(x !== null && x !== void 0);
  return x;
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

export function assertIsInteger(x: unknown): number {
  assert(isInteger(x), `value=${x} is not a number.`);
  return x;
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

export function parseBoolean(x: unknown): boolean | null {
  return isBoolean(x)
    ? x
    : x === 'true'
    ? true
    : x === 'false'
    ? false
    : x === null || x === undefined
    ? null
    : throwError(`${x} is not a boolean`);
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

export function assertIsArray(x: unknown): unknown[] {
  return Array.isArray(x)
    ? x
    : throwError(`'${JSON.stringify(x)}' is not an array.`);
}

export function throwError(errorMessage: string): never {
  throw new Error(errorMessage);
}
