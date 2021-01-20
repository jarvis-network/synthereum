import { throwError } from '@jarvis-network/web3-utils/base/asserts';
import { t } from '@jarvis-network/web3-utils/base/meta';
import { AddressOn } from '@jarvis-network/web3-utils/eth/address';
import { getTokenBalance } from '@jarvis-network/web3-utils/eth/contracts/erc20';
import { getContract } from '@jarvis-network/web3-utils/eth/contracts/get-contract';
import { Web3On } from '@jarvis-network/web3-utils/eth/web3-instance';
import { allSupportedSymbols } from '../config/data/all-synthetic-asset-symbols';
import { SupportedNetworkName } from '../config/supported-networks';
import {
  IDerivative_Abi,
  SynthereumPool_Abi,
  SynthereumTIC_Abi,
} from '../contracts/abi';
import { IDerivative } from '../contracts/typechain';
import { PoolContract, PoolVersion } from './types/pools';
import { SynthereumRealmWithWeb3 } from './types/realm';
export interface PoolAddressWithDerivates<Version extends PoolVersion> {
  result: PoolContract<Version>;
  derivativeAddress: IDerivative;
}
export async function getPool<
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
        derivatesAddresses[derivatesAddresses.length - 1],
      ).instance,
    };
  }
  throwError(`Unsupported pool version: '${version}'`);
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
