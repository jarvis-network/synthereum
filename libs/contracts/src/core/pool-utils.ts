import BN from 'bn.js';
import {
  assertNotNull,
  throwError,
} from '@jarvis-network/web3-utils/base/asserts';
import { last } from '@jarvis-network/web3-utils/base/array-fp-utils';
import { Amount } from '@jarvis-network/web3-utils/base/big-number';
import { t, OneOf } from '@jarvis-network/web3-utils/base/meta';
import {
  AddressOn,
  assertIsAddress,
} from '@jarvis-network/web3-utils/eth/address';
import {
  getTokenBalance,
  erc20Transfer,
} from '@jarvis-network/web3-utils/eth/contracts/erc20';
import { getContract } from '@jarvis-network/web3-utils/eth/contracts/get-contract';
import { Web3On } from '@jarvis-network/web3-utils/eth/web3-instance';
import type { SupportedNetworkName, SyntheticSymbol } from '../config';
import {
  IDerivative_Abi,
  SynthereumPool_Abi,
  SynthereumTIC_Abi,
} from '../contracts/abi';
import { IDerivative } from '../contracts/typechain';
import {
  PoolContract,
  PoolVersion,
  PoolVersions,
  SynthereumPool,
} from './types/pools';
import { SynthereumRealm, SynthereumRealmWithWeb3 } from './types/realm';

export function foreachPool<
  Net extends SupportedNetworkName = SupportedNetworkName,
  Version extends PoolVersion = PoolVersion
>(
  realm: SynthereumRealm<Net>,
  version: Version,
  callback: (
    pool: SynthereumPool<OneOf<Version, PoolVersions>, Net, SyntheticSymbol>,
    idx: number,
  ) => void,
) {
  const pools = assertNotNull(realm.pools[version as PoolVersion]);
  let idx = 0;
  console.log('Number of available pools:' + Object.keys(pools).length);
  for (const key in pools) {
    if (!pools.hasOwnProperty(key)) continue;
    const pool = pools[key as keyof typeof pools];
    if (!pool) continue;
    callback(
      pool as SynthereumPool<
        OneOf<Version, PoolVersions>,
        Net,
        SyntheticSymbol
      >,
      idx++,
    );
  }
}

export function mapPools<
  Result,
  Net extends SupportedNetworkName = SupportedNetworkName,
  Version extends PoolVersion = PoolVersion
>(
  realm: SynthereumRealm<Net>,
  version: Version,
  callback: (
    p: SynthereumPool<OneOf<Version, PoolVersions>, Net, SyntheticSymbol>,
    idx: number,
  ) => Result,
) {
  const array: Result[] = [];
  foreachPool(realm, version, (pool, idx) => array.push(callback(pool, idx)));
  return array;
}

export interface PoolAddressWithDerivates<Version extends PoolVersion> {
  result: PoolContract<Version>;
  derivativeAddress: IDerivative;
}

export async function loadPool<
  Net extends SupportedNetworkName,
  Version extends PoolVersion
>(
  web3: Web3On<Net>,
  version: Version,
  poolAddress: AddressOn<Net>,
): Promise<PoolAddressWithDerivates<Version>> {
  if (version === 'v1') {
    const result = getContract(web3, SynthereumTIC_Abi, poolAddress).instance;
    const derivatesAddress = (await result.methods
      .derivative()
      .call()) as AddressOn<Net>;
    return {
      result: result as PoolContract<Version>,
      derivativeAddress: getContract(web3, IDerivative_Abi, derivatesAddress)
        .instance,
    };
  } else if (version === 'v2') {
    const result = getContract(web3, SynthereumPool_Abi, poolAddress).instance;
    const derivatesAddresses = (await result.methods
      .getAllDerivatives()
      .call()) as AddressOn<Net>[];

    return {
      result: result as PoolContract<Version>,
      derivativeAddress: getContract(
        web3,
        IDerivative_Abi,
        last(derivatesAddresses),
      ).instance,
    };
  }
  throwError(`Unsupported pool version: '${version}'`);
}

export function getPoolBalances<
  Net extends SupportedNetworkName,
  Version extends PoolVersion
>(realm: SynthereumRealm<Net>, version: Version = 'v1' as Version) {
  return Promise.all(
    mapPools(realm, version, async p =>
      t(p.symbol, await getTokenBalance(realm.collateralToken, p.address)),
    ),
  );
}

export async function depositInAllPools<Net extends SupportedNetworkName>(
  realm: SynthereumRealmWithWeb3<Net>,
  version: PoolVersion,
  amount: Amount,
  gasPrice?: number,
) {
  const poolsCount = Object.keys(realm.pools[version] ?? {}).length;
  const from = assertIsAddress<Net>(realm.web3.defaultAccount);
  const nonce = await realm.web3.eth.getTransactionCount(from);
  const perPool = amount.div(new BN(poolsCount)) as Amount;
  return mapPools(realm, version, (pool, i) =>
    erc20Transfer(realm.collateralToken, pool.address, perPool, {
      from,
      gasPrice,
      nonce: nonce + i,
    }),
  );
}
