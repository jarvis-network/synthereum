declare module '*.ttf';
declare module '*.png';
declare module '*.svg';

/*
 * DeepPartial works similar to Partial generic,
 * but it makes full object tree optional.
 *
 * {
 *    a: {
 *      b: string;
 *    }
 * }
 *
 * Partial will make only "a" property optional. DeepPartial will make "a" and "a.b" option as well.
 */
type DeepPartial<T> = {
  [P in keyof T]?: DeepPartial<T[P]>;
};
