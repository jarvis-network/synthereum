import {
  IDerivative,
  SynthereumPoolOnChainPriceFeed as SynthereumPoolOnChainPriceFeedContract,
} from '@jarvis-network/synthereum-contracts/dist/contracts/typechain';
import { assertIncludes } from '@jarvis-network/core-utils/dist/base/asserts';
import {
  ContractInfo,
  TokenInfo,
} from '@jarvis-network/core-utils/dist/eth/contracts/types';
import { ToNetworkId } from '@jarvis-network/core-utils/dist/eth/networks';

import type {
  SupportedNetworkName,
  SyntheticSymbol,
} from '@jarvis-network/synthereum-contracts/dist/config';
import { priceFeed } from '@jarvis-network/synthereum-contracts/dist/config';

export const poolVersions = ['v3'] as const;
export type PoolVersions = typeof poolVersions;
export type PoolVersion = PoolVersions[number];

export function assertIsSupportedPoolVersion(x: unknown): PoolVersion {
  return assertIncludes(
    poolVersions,
    x,
    `'${x}' is not a supported pool version`,
  );
}

export type PoolContract<Version extends PoolVersion> = Version extends 'v3'
  ? SynthereumPoolOnChainPriceFeedContract
  : never;

export interface SynthereumPool<
  Version extends PoolVersion,
  Net extends SupportedNetworkName = SupportedNetworkName,
  SynthSymbol extends SyntheticSymbol = SyntheticSymbol
> extends ContractInfo<Net, PoolContract<Version>> {
  networkId: ToNetworkId<Net>;
  versionId: Version;
  symbol: SynthSymbol;
  priceFeed: typeof priceFeed[SynthSymbol];
  collateralToken: TokenInfo<Net>;
  syntheticToken: TokenInfo<Net>;
  derivative: ContractInfo<Net, IDerivative>;
}

export type PoolsForVersion<
  Version extends PoolVersion,
  Net extends SupportedNetworkName
> = {
  [SynthSymbol in SyntheticSymbol]?: SynthereumPool<Version, Net, SynthSymbol>;
};
