import { assertIncludes } from '@jarvis-network/web3-utils/base/asserts';
import {
  ContractInfo,
  TokenInfo,
} from '@jarvis-network/web3-utils/eth/contracts/types';
import { ToNetworkId } from '@jarvis-network/web3-utils/eth/networks';
import type { SupportedNetworkName, SyntheticSymbol } from '../../config';
import { priceFeed } from '../../config';
import {
  IDerivative,
  SynthereumPool as SynthereumPool_Contract,
  SynthereumTIC as SynthereumTIC_Contract,
  SynthereumPoolOnChainPriceFeed as SynthereumPoolOnChainPriceFeed_Contract,
} from '../../contracts/typechain';

export const poolVersions = ['v1', 'v2', 'v3'] as const;
export type PoolVersions = typeof poolVersions;
export type PoolVersion = PoolVersions[number];

export function assertIsSupportedPoolVersion(x: unknown): PoolVersion {
  return assertIncludes(
    poolVersions,
    x,
    `'${x}' is not a supported pool version`,
  );
}

export type PoolContract<Version extends PoolVersion> = Version extends 'v1'
  ? SynthereumTIC_Contract
  : Version extends 'v2'
  ? SynthereumPool_Contract
  : Version extends 'v3'
  ? SynthereumPoolOnChainPriceFeed_Contract
  : never;

export interface SynthereumPool<
  Version extends PoolVersion,
  Net extends SupportedNetworkName = SupportedNetworkName,
  Symbol extends SyntheticSymbol = SyntheticSymbol
> extends ContractInfo<Net, PoolContract<Version>> {
  networkId: ToNetworkId<Net>;
  versionId: Version;
  symbol: Symbol;
  priceFeed: typeof priceFeed[Symbol];
  collateralToken: TokenInfo<Net>;
  syntheticToken: TokenInfo<Net>;
  derivative: ContractInfo<Net, IDerivative>;
}

export type PoolsForVersion<
  Version extends PoolVersion,
  Net extends SupportedNetworkName
> = {
  [Symbol in SyntheticSymbol]?: SynthereumPool<Version, Net, Symbol>;
};
