/// Helper for creating a tuple with inferred types
export const t = <T extends any[]>(...args: T): T => args;

export type KeysOf<T> = keyof T;
export type ValuesOf<T> = T[KeysOf<T>];

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
