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
