/// Helper for creating a tuple with inferred types
export const t = <T extends any[]>(...args: T): T => args;

export type KeysOf<T> = keyof T;
export type ValuesOf<T> = T[KeysOf<T>];
export type Entries<T> = {
  [K in keyof T]: [K, T[K]];
}[keyof T][];

export type Obj = Record<string | number, unknown>;

export function entriesOf<T extends Obj>(obj: T): Entries<T> {
  return Object.entries(obj) as Entries<T>;
}

export function keysOf<T extends Obj>(obj: T): (keyof T)[] {
  return Object.keys(obj);
}

export function valuesOf<T extends Obj>(obj: T): ValuesOf<T>[] {
  return Object.values(obj) as ValuesOf<T>[];
}

export type OneOf<
  T,
  V extends readonly any[],
  NK extends keyof V = Exclude<keyof V, keyof any[]>,
> = { [K in NK]: T extends V[K] ? V[K] : never }[NK];

/**
 * Gets the object representation of a type. Useful for "flattening" interesction types.
 *
 * Example:
 * ```ts
 * type A = { a: 1; b: 2; };
 * type B = { c: 3; };
 * type Merged = Id<A & B>;
 * ```
 * Becomes:
 * ```ts
 * type Merged = { a: 1; b: 2; c: 3; }
 * ```
 */
// eslint-disable-next-line @typescript-eslint/ban-types
export type Id<T> = {} & { [K in keyof T]: T[K] };

export type KeyFromValue<V, T extends Record<PropertyKey, PropertyKey>> = {
  [K in KeysOf<T>]: V extends T[K] ? K : never;
}[keyof T];

/// Computes the inverse map of an object.
/// Example: { a: 1, b: 2} => { 1: a, 2: b}
export type InverseOf<T extends Record<PropertyKey, PropertyKey>> = {
  [V in ValuesOf<T>]: KeyFromValue<V, T>;
};

export type KeysToKeys<T> = { [P in keyof T]: P };

export type DeepPartial<T> = {
  [P in keyof T]?: DeepPartial<T[P]>;
};

export type DeepReadonly<T> = {
  readonly [P in keyof T]: DeepReadonly<T[P]>;
};

export function typeCheck<Expected>() {
  return function <Actual extends DeepReadonly<Expected>>(
    value: Actual,
  ): Actual {
    return value;
  };
}

export type PerTupleElement<Tuple extends readonly any[], T> = {
  [key in Tuple[number]]: T;
};

export function mapTupleToObject<
  Tuple extends readonly any[],
  F extends (elem: Tuple[number], index: number) => T,
  T,
>(tuple: Tuple, mapFun: F): PerTupleElement<Tuple, T> {
  const result: Record<Tuple[number], T> = Object.fromEntries(
    tuple.map((elem, i) => t(elem, mapFun(elem, i))),
  );
  return result;
}
