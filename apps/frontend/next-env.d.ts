/// <reference types="next" />
/// <reference types="next/types/global" />

declare module 'ric-shim' {
  declare function ric(cb: Function): void;
  export = ric;
}
