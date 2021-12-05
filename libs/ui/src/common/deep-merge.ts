/* eslint-disable @typescript-eslint/no-unnecessary-type-constraint */
/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
/* eslint-disable no-restricted-syntax */

export type PrimitiveType =
  | undefined
  | null
  | boolean
  | number
  | string
  | symbol
  | bigint;

export type NumberTypedArray =
  | Int8Array
  | Uint8Array
  | Uint8ClampedArray
  | Int16Array
  | Uint16Array
  | Int32Array
  | Uint32Array
  | Float32Array
  | Float64Array;

export type BigIntTypedArray = BigInt64Array | BigUint64Array;

export type TypedArray = NumberTypedArray | BigIntTypedArray;

export type Obj = Record<string, unknown>;

const isObj = (x: unknown): x is Obj => typeof x === 'object' && !!x;

const customGlobal: typeof globalThis = global ?? window;

export function deepSanitizedClone<T extends PrimitiveType>(x: T): T;
export function deepSanitizedClone<T extends TypedArray>(x: T): T;
export function deepSanitizedClone<T extends U[], U>(x: T): T;
export function deepSanitizedClone<T extends Obj>(x: T): T;
export function deepSanitizedClone<T extends unknown>(x: T): T;
export function deepSanitizedClone<T>(x: T) {
  if (typeof x !== 'object' || !x) return x;
  if (
    x instanceof Number ||
    x instanceof String ||
    x instanceof Boolean ||
    (customGlobal.BigInt && x instanceof customGlobal.BigInt) ||
    (customGlobal.Symbol && x instanceof customGlobal.Symbol)
  )
    // unbox primitive types
    return x.valueOf();

  // Handle typed arrays, like UintXArray
  if (ArrayBuffer.isView(x)) {
    if (x instanceof DataView)
      throw new Error('DataView types are not supported.');
    return ((x as unknown) as TypedArray).slice();
  }

  // Handle regular arrays
  if (Array.isArray(x)) {
    const result = x.slice();
    for (let i = 0; i < result.length; i++) {
      result[i] = deepSanitizedClone(result[i]);
    }
    return result;
  }

  const result: Partial<T> = {};
  for (const key in x) {
    if (!Object.prototype.hasOwnProperty.call(x, key)) continue;
    result[key] = deepSanitizedClone(x[key]);
  }
  return result as T;
}

export function deepMerge<T extends Obj, R extends Obj[]>(
  first: T,
  ...rest: R
): T & R[number] {
  const result: Obj = deepSanitizedClone(first);

  for (const custom of rest) {
    for (const key in custom) {
      if (!Object.prototype.hasOwnProperty.call(custom, key)) continue;
      if (!(key in custom) || custom[key] === undefined) continue;
      const dst = result[key];
      const src = custom[key];
      if (isObj(src) && isObj(dst)) {
        result[key] = deepMerge(dst, src);
      } else {
        result[key] = src;
      }
    }
  }

  return result as T & R[number];
}
