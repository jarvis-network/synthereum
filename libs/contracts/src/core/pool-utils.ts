import BN from 'bn.js';
import {
  assertNotNull,
  throwError,
} from '@jarvis-network/web3-utils/base/asserts';
import { last } from '@jarvis-network/web3-utils/base/array-fp-utils';
import { Amount } from '@jarvis-network/web3-utils/base/big-number';
import { t, OneOf, keysOf } from '@jarvis-network/web3-utils/base/meta';
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

import { TransactionReceipt } from 'web3-core';

import {
  FullTxOptions,
  TxOptions,
  sendTxAndLog,
} from '@jarvis-network/web3-utils/eth/contracts/send-tx';

import { executeInSequence } from '@jarvis-network/web3-utils/base/async';

import {
  SupportedNetworkId,
  SupportedNetworkName,
  synthereumConfig,
  SyntheticSymbol,
} from '../config';
import {
  IDerivative_Abi,
  SynthereumPool_Abi,
  SynthereumPoolOnChainPriceFeed_Abi,
  SynthereumTIC_Abi,
} from '../contracts/abi';
import {
  IDerivative,
  NonPayableTransactionObject,
} from '../contracts/typechain';

import { Fees } from '../config/types';

import {
  PoolContract,
  PoolsForVersion,
  PoolVersion,
  PoolVersions,
  SynthereumPool,
} from './types/pools';
import { SynthereumRealm, SynthereumRealmWithWeb3 } from './types/realm';

export function getAvailableSymbols<
  Net extends SupportedNetworkName = SupportedNetworkName,
  Version extends PoolVersion = PoolVersion
>(realm: SynthereumRealm<Net>, version: OneOf<Version, PoolVersions>) {
  const pool = assertNotNull(
    realm.pools[version] as PoolsForVersion<Version, Net>,
  );
  return keysOf(pool);
}

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
): void {
  const pools = assertNotNull(realm.pools[version as PoolVersion]);
  let idx = 0;
  for (const key in pools) {
    if (!Object.prototype.hasOwnProperty.call(pools, key)) continue;
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
): Result[] {
  const array: Result[] = [];
  foreachPool(realm, version, (pool, idx) => array.push(callback(pool, idx)));
  return array;
}

export interface PoolAddressWithDerivatives<Version extends PoolVersion> {
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
): Promise<PoolAddressWithDerivatives<Version>> {
  if (version === 'v1') {
    const result = getContract(web3, SynthereumTIC_Abi, poolAddress).instance;
    const derivativeAddress = (await result.methods
      .derivative()
      .call()) as AddressOn<Net>;
    return {
      result: result as PoolContract<Version>,
      derivativeAddress: getContract(web3, IDerivative_Abi, derivativeAddress)
        .instance,
    };
  }
  if (version === 'v2') {
    const result = getContract(web3, SynthereumPool_Abi, poolAddress).instance;
    const derivativeAddresses = (await result.methods
      .getAllDerivatives()
      .call()) as AddressOn<Net>[];

    return {
      result: result as PoolContract<Version>,
      derivativeAddress: getContract(
        web3,
        IDerivative_Abi,
        last(derivativeAddresses),
      ).instance,
    };
  }
  if (version === 'v3') {
    const result = getContract(
      web3,
      SynthereumPoolOnChainPriceFeed_Abi,
      poolAddress,
    ).instance;
    const derivativeAddresses = (await result.methods
      .getAllDerivatives()
      .call()) as AddressOn<Net>[];

    return {
      result: result as PoolContract<Version>,
      derivativeAddress: getContract(
        web3,
        IDerivative_Abi,
        last(derivativeAddresses),
      ).instance,
    };
  }
  throwError(`Unsupported pool version: '${version}'`);
}

export function getPoolBalances<
  Net extends SupportedNetworkName,
  Version extends PoolVersion
>(
  realm: SynthereumRealm<Net>,
  version: Version = 'v1' as Version,
): Promise<[SyntheticSymbol, Amount][]> {
  return Promise.all(
    mapPools(realm, version, async p =>
      t(p.symbol, await getTokenBalance(realm.collateralToken, p.address)),
    ),
  );
}

export function depositInAllPools<Net extends SupportedNetworkName>(
  realm: SynthereumRealmWithWeb3<Net>,
  version: PoolVersion,
  amount: Amount,
  txOptions: TxOptions,
): Promise<TransactionReceipt[]> {
  const poolsCount = Object.keys(realm.pools[version] ?? {}).length;
  const from = assertIsAddress<Net>(realm.web3.defaultAccount);
  const perPool = amount.div(new BN(poolsCount)) as Amount;
  return executeInSequence(
    ...mapPools(realm, version, pool => () =>
      erc20Transfer(realm.collateralToken, pool.address, perPool, {
        ...txOptions,
        web3: realm.web3,
        from,
      }).then(result => result.promiEvent),
    ),
  );
}

interface RoleChange<Net extends SupportedNetworkName> {
  previousAddress: AddressOn<Net>;
  newAddress: AddressOn<Net>;
}

type PoolParameters<Net extends SupportedNetworkName> = {
  lp?: RoleChange<Net>;
  validator?: RoleChange<Net>;
  newFees?: Readonly<Fees<Net>>;
  perPool?: {
    [key in SyntheticSymbol]?: {
      startingCollateralization?: BN;
    };
  };
  allowContractsUpdate?: {
    enabled: boolean;
  };
};

export async function updateV2PoolParameters<Net extends SupportedNetworkName>(
  realm: SynthereumRealmWithWeb3<Net>,
  {
    newFees,
    lp,
    validator,
    perPool,
    allowContractsUpdate,
  }: PoolParameters<Net>,
  _txOpt: TxOptions,
): Promise<void> {
  const maintainer = synthereumConfig[realm.netId as SupportedNetworkId].roles
    .maintainer as AddressOn<Net>;

  const txOptions: FullTxOptions<Net> = {
    web3: realm.web3,
    ..._txOpt,
    from: maintainer,
  };

  await executeInSequence(
    ...mapPools(realm, 'v2', pool => async () => {
      if (lp) {
        await changeRole(pool, 'LIQUIDITY_PROVIDER_ROLE', lp, txOptions);
      }

      if (validator) {
        await changeRole(pool, 'VALIDATOR_ROLE', validator, txOptions);
      }

      if (allowContractsUpdate) {
        const allowed = await pool.instance.methods.isContractAllowed().call();
        if (allowed !== allowContractsUpdate.enabled) {
          const tx0 = pool.instance.methods.setIsContractAllowed(
            allowContractsUpdate.enabled,
          );
          await sendTxWithMsg(tx0, txOptions, 'setIsContractAllowed');
        }
      }

      if (newFees) {
        const tx1 = pool.instance.methods.setFee([
          [newFees.feePercentage],
          newFees.feeRecipients,
          newFees.feeProportions,
        ]);
        await sendTxWithMsg(tx1, txOptions, 'setFee');
      }

      const { startingCollateralization } = perPool?.[pool.symbol] ?? {};

      if (startingCollateralization) {
        const tx6 = pool.instance.methods.setStartingCollateralization(
          startingCollateralization.toString(10),
        );
        await sendTxWithMsg(tx6, txOptions, 'setStartingCollateralization');
      }
    }),
  );
}

export type Roles<
  Version extends PoolVersion,
  Net extends SupportedNetworkName
> = Extract<
  keyof SynthereumPool<Version, Net>['instance']['methods'],
  `${string}_ROLE`
>;

export async function changeRole<
  Version extends PoolVersion,
  Net extends SupportedNetworkName,
  RoleName extends Roles<Version, Net>
>(
  pool: SynthereumPool<Version, Net>,
  roleName: RoleName,
  role: RoleChange<Net>,
  txOptions: FullTxOptions<Net>,
): Promise<void> {
  const { methods } = pool.instance;

  if (!(roleName in methods)) {
    throwError(`Role '${roleName}' not found.`);
  }

  type Keys = Extract<keyof typeof methods, RoleName>;
  const roleId = await methods[roleName as Keys]().call();

  const hasRole = await pool.instance.methods
    .hasRole(roleId, role.previousAddress)
    .call();

  if (!hasRole) {
    throwError(
      `Expected address '${role.previousAddress}' to have role '${roleName} at pool ${pool.address}'`,
    );
  }

  const from =
    synthereumConfig[pool.networkId as SupportedNetworkId].roles.admin;

  const tx1 = pool.instance.methods.revokeRole(roleId, role.previousAddress);
  await sendTxWithMsg(
    tx1,
    { ...txOptions, from },
    `Revoking '${roleName}' Role`,
  );
  const tx2 = pool.instance.methods.grantRole(roleId, role.newAddress);
  await sendTxWithMsg(
    tx2,
    { ...txOptions, from },
    `Granting '${roleName}' Role`,
  );
}

function sendTxWithMsg<T>(
  tx: NonPayableTransactionObject<T>,
  txOpt: FullTxOptions<SupportedNetworkName>,
  msg: string,
): Promise<TransactionReceipt> {
  txOpt.printInfo ??= {};
  txOpt.printInfo.txSummaryText = msg;
  return sendTxAndLog(tx, txOpt);
}
