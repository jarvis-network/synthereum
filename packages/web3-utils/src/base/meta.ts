/// Helper for creating a tuple with inferred types
export const t = <T extends any[]>(...args: T): T => args;

export type KeysOf<T> = keyof T;
export type ValuesOf<T> = T[KeysOf<T>];

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

export function typeCheck<Expected>() {
  return function <Actual extends Readonly<Expected>>(value: Actual): Actual {
    return value;
  };
}
