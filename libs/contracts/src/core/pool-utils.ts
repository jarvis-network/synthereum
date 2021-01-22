import { throwError } from '@jarvis-network/web3-utils/base/asserts';
import { t } from '@jarvis-network/web3-utils/base/meta';
import { AddressOn } from '@jarvis-network/web3-utils/eth/address';
import { getTokenBalance } from '@jarvis-network/web3-utils/eth/contracts/erc20';
import { getContract } from '@jarvis-network/web3-utils/eth/contracts/get-contract';
import { Web3On } from '@jarvis-network/web3-utils/eth/web3-instance';
import { allSupportedSymbols } from '../config/data/all-synthetic-asset-symbols';
import { SupportedNetworkName } from '../config/supported-networks';
import { SynthereumPool_Abi, SynthereumTIC_Abi } from '../contracts/abi';
import {
  SynthereumPool as SynthereumPool_Contract,
  SynthereumTIC as SynthereumTIC_Contract,
} from '../contracts/typechain';
import { PoolContract, PoolVersion } from './types/pools';
import { SynthereumRealmWithWeb3 } from './types/realm';

export function getPool<
  Net extends SupportedNetworkName,
  Version extends PoolVersion
>(
  web3: Web3On<Net>,
  version: Version,
  poolAddress: AddressOn<Net>,
): PoolContract<Version> {
  const result: SynthereumTIC_Contract | SynthereumPool_Contract =
    version === 'v1'
      ? getContract(web3, SynthereumTIC_Abi, poolAddress).instance
      : version === 'v2'
      ? getContract(web3, SynthereumPool_Abi, poolAddress).instance
      : throwError(`Unsupported pool version: '${version}'`);
  return result as PoolContract<Version>;
}

export async function getPoolBalances<
  Net extends SupportedNetworkName,
  Version extends PoolVersion
>(realm: SynthereumRealmWithWeb3<Net>, version: Version = 'v1' as Version) {
  const balanceOf = (address: AddressOn<Net>) =>
    getTokenBalance(realm.collateralToken, address);
  const balances = await Promise.all(
    allSupportedSymbols.map(async symbol =>
      t(symbol, await balanceOf(realm.pools[version][symbol].address)),
    ),
  );

  return balances;
}
