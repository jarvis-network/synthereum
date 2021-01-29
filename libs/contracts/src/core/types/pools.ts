import {
  ContractInfo,
  TokenInfo,
} from '@jarvis-network/web3-utils/eth/contracts/types';
import { SupportedNetworkName, SyntheticSymbol } from '../../config';
import { priceFeed } from '../../config/data/price-feed';
import {
  SynthereumPool as SynthereumPool_Contract,
  SynthereumTIC as SynthereumTIC_Contract,
} from '../../contracts/typechain';

export type PoolVersion = 'v1' | 'v2';

export function assertIsSupportedPoolVersion(x: unknown): PoolVersion {
  if (x === 'v1' || x === 'v2') return x;
  throw new Error(`'${x}' is not a supported pool version`);
}

export type PoolContract<Version extends PoolVersion> = Version extends 'v1'
  ? SynthereumTIC_Contract
  : Version extends 'v2'
  ? SynthereumPool_Contract
  : never;

export interface SynthereumPool<
  Version extends PoolVersion,
  Net extends SupportedNetworkName = SupportedNetworkName,
  Symbol extends SyntheticSymbol = SyntheticSymbol
> extends ContractInfo<Net, PoolContract<Version>> {
  symbol: Symbol;
  priceFeed: typeof priceFeed[Symbol];
  collateralToken: TokenInfo<Net>;
  syntheticToken: TokenInfo<Net>;
}

export type PoolsForVersion<
  Version extends PoolVersion,
  Net extends SupportedNetworkName
> = {
  [Symbol in SyntheticSymbol]: SynthereumPool<Version, Net, Symbol>;
};
