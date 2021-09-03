export const poolVersions = ['v4'] as const;
export type PoolVersions = typeof poolVersions;
export type PoolVersion = PoolVersions[number];
