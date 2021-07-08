/// <reference types="next" />
/// <reference types="next/types/global" />

declare module '*.md';

declare module 'ethereum-blockies' {
  interface Options {
    seed?: string;
    size?: number;
    scale?: number;
    color?: string;
    bgcolor?: string;
    spotcolor?: string;
  }

  export function create(opts: Options);
}

type TheGraphBytes = string;
type TheGraphBigInt = string;
