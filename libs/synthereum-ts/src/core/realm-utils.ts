import {
  CollateralSymbol,
  ExchangeToken,
  PoolVersion,
  SupportedNetworkName,
  SyntheticSymbol,
} from '@jarvis-network/synthereum-contracts/dist/config';
import { AddressOn } from 'libs/core-utils/dist/eth/address';

import { PoolsForVersion, SynthereumPool } from './types/pools';
import type { SynthereumRealmWithWeb3 } from './types/realm';

export function isSupportedSynth<
  Version extends PoolVersion,
  Net extends SupportedNetworkName
>(
  activePools: PoolsForVersion<Version, Net>,
  token: ExchangeToken,
): token is SyntheticSymbol {
  return token in activePools;
}

export function isSupportedCollateral<
  Version extends PoolVersion,
  Net extends SupportedNetworkName
>(
  activePools: PoolsForVersion<Version, Net>,
  token: ExchangeToken,
): token is CollateralSymbol {
  // TODO: optimize by caching a table of all known collateral symbols
  return Object.values(activePools).some(
    pool => pool?.collateralToken.symbol === token,
  );
}

type TxType = 'mint' | 'exchange' | 'redeem' | 'unsupported';

export function determineSide<
  Version extends PoolVersion,
  Net extends SupportedNetworkName
>(
  activePools: PoolsForVersion<Version, Net>,
  input: ExchangeToken,
  output: ExchangeToken,
): TxType {
  const synthInput = isSupportedSynth(activePools, input);
  const synthOutput = isSupportedSynth(activePools, output);
  const collateralInput = isSupportedCollateral(activePools, input);
  const collateralOutput = isSupportedCollateral(activePools, output);
  if (collateralInput && synthOutput) return 'mint';
  if (synthInput && collateralOutput) return 'redeem';
  if (synthInput && synthOutput) return 'exchange';
  return 'unsupported';
}

interface SerializableERC20<
  Net extends SupportedNetworkName = SupportedNetworkName
> {
  symbol: string;
  decimals: number;
  address: AddressOn<Net>;
  instance?: never;
}

export type SerializablePools<
  Net extends SupportedNetworkName = SupportedNetworkName,
  Version extends PoolVersion = PoolVersion
> = {
  [SynthSymbol in SyntheticSymbol]?: Omit<
    SynthereumPool<Version, Net, SynthSymbol>,
    'derivative' | 'collateralToken' | 'syntheticToken' | 'instance'
  > & {
    derivative: AddressOn<Net>;
    collateralToken: SerializableERC20<Net>;
    syntheticToken: SerializableERC20<Net>;
    instance?: never;
  };
};

export function getSerializablePoolsFromRealm<
  Net extends SupportedNetworkName,
  Version extends PoolVersion
>(
  realm: SynthereumRealmWithWeb3<Net>,
  poolVersion: Version,
): SerializablePools<Net, Version> {
  const pools = realm.pools[poolVersion];
  if (!pools)
    throw new Error(`Pool version ${poolVersion} not loaded in realm`);

  const serializablePools: SerializablePools<Net, Version> = {};

  // eslint-disable-next-line guard-for-in
  for (const i in pools) {
    const pool = pools[i as 'jEUR'] as SynthereumPool<Version, Net, 'jEUR'>;
    if (!pool) continue;
    const { collateralToken, syntheticToken } = pool;
    const serializablePool: SerializablePools<Net, Version>['jEUR'] = {
      ...pool,
      derivative: pool.derivative.address,
      collateralToken: {
        symbol: collateralToken.symbol as AddressOn<Net>,
        decimals: collateralToken.decimals,
        address: collateralToken.address,
      },
      syntheticToken: {
        symbol: syntheticToken.symbol as AddressOn<Net>,
        decimals: syntheticToken.decimals,
        address: syntheticToken.address,
      },
      instance: undefined,
    };
    delete serializablePool.instance;
    serializablePools[i as 'jEUR'] = serializablePool;
  }

  return serializablePools;
}
