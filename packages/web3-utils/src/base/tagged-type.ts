export declare class Tag<T> { protected __tag__: T; }
export type Tagged<T, U> = T & Tag<U>;
export type TagOf<T> = T extends infer U & Tag<infer N> ? N : never;
