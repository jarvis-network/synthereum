import { ISynthereumRegistry_Abi } from '@jarvis-network/synthereum-contracts/dist/contracts/abi';
import { ISynthereumRegistry } from '@jarvis-network/synthereum-contracts/dist/contracts/typechain';
import { throwError } from '@jarvis-network/core-utils/dist/base/asserts';
import { last } from '@jarvis-network/core-utils/dist/base/array-fp-utils';
import { t } from '@jarvis-network/core-utils/dist/base/meta';
import {
  AddressOn,
  assertIsAddress,
  isAddress,
} from '@jarvis-network/core-utils/dist/eth/address';
import { getContract } from '@jarvis-network/core-utils/dist/eth/contracts/get-contract';
import type { ToNetworkId } from '@jarvis-network/core-utils/dist/eth/networks';
import type { Web3On } from '@jarvis-network/core-utils/dist/eth/web3-instance';

import {
  supportedSynthereumPairs,
  SupportedSynthereumSymbol,
} from '@jarvis-network/synthereum-config/dist/supported/synthereum-pairs';

import {
  SynthereumContractDependencies,
  SupportedNetworkName,
  synthereumConfig,
  SupportedNetworkId,
  priceFeed,
} from '../../../config';
import { loadPool } from '../../pool-utils';
import type {
  PoolsForVersion,
  PoolVersion,
  SynthereumPool,
} from '../../types/pools';
import type { SynthereumRealmWithWeb3 } from '../../types/realm';

import { getTokenInfo } from '../comman-realm';

export type PoolVersionsToLoad<Net extends SupportedNetworkName> = {
  [Version in PoolVersion]?: PoolsForVersion<Version, Net> | null;
};

/**
 * Load the default Synthereum Realm.
 * @param web3 Web3 instance to connect to
 * @param netId Integer representing one of the supported network ids
 */
export function loadRealm<Net extends SupportedNetworkName>(
  web3: Web3On<Net>,
  netId: ToNetworkId<Net>,
  versionsToLoad?: PoolVersionsToLoad<Net>,
): Promise<SynthereumRealmWithWeb3<Net>> {
  const config = synthereumConfig[netId as SupportedNetworkId]
    .contractsDependencies.synthereum as SynthereumContractDependencies<Net>;
  return loadCustomRealm(web3, netId, config, versionsToLoad);
}

/**
 * Load a custom Synthereum Realm, identified by the `config` parameter.
 * @param web3 Web3 instance to connect to
 * @param config Configuration object containing all of the contract
 * dependencies
 */
export async function loadCustomRealm<Net extends SupportedNetworkName>(
  web3: Web3On<Net>,
  netId: ToNetworkId<Net>,
  config: SynthereumContractDependencies<Net>,
  versionsToLoad: PoolVersionsToLoad<Net> = { v4: null },
): Promise<SynthereumRealmWithWeb3<Net>> {
  const poolRegistry = getContract(
    web3,
    ISynthereumRegistry_Abi,
    config.poolRegistry,
  );

  const collateralAddress = config.primaryCollateralToken.address;

  const loadAllPools = async <Version extends PoolVersion>(
    version: Version,
  ) => {
    const pairs = await Promise.all(
      supportedSynthereumPairs[netId].map(async (symbol: any) => {
        const info = await loadPoolInfo(
          web3,
          netId,
          poolRegistry.instance,
          collateralAddress,
          version,
          symbol,
        );
        return t(symbol, info);
      }),
    );

    return Object.fromEntries(pairs.filter(x => !!x[1]));
  };

  const pools: SynthereumRealmWithWeb3<Net>['pools'] = {};
  for (const i in versionsToLoad) {
    if (!Object.prototype.hasOwnProperty.call(versionsToLoad, i)) continue;
    const version = i as PoolVersion;
    const poolsForVersion = versionsToLoad[version];
    pools[version] =
      typeof poolsForVersion === 'object' && poolsForVersion !== null
        ? poolsForVersion
        : // eslint-disable-next-line no-await-in-loop
          await loadAllPools(version);
  }

  return {
    web3,
    netId,
    poolRegistry,
    pools,
  };
}

function poolVersionId(version: PoolVersion) {
  return version === 'v4'
    ? 4
    : throwError(`'${version}' is not a supported pool version`);
}

export async function loadPoolInfo<
  Version extends PoolVersion,
  SynthSymbol extends SupportedSynthereumSymbol<Net>,
  Net extends SupportedNetworkName
>(
  web3: Web3On<Net>,
  netId: ToNetworkId<Net>,
  poolRegistry: ISynthereumRegistry,
  collateralAddress: AddressOn<Net>,
  version: Version,
  symbol: SynthSymbol,
): Promise<SynthereumPool<Version, Net, SynthSymbol> | null> {
  const versionId = poolVersionId(version);
  const poolAddresses = await poolRegistry.methods
    .getElements(symbol, collateralAddress, versionId)
    .call();

  // Assume the last address in the array is the one we should interact with
  const lastPoolAddress = last(poolAddresses);

  if (!isAddress(lastPoolAddress)) {
    return null;
  }

  const poolAddress = assertIsAddress(lastPoolAddress) as AddressOn<Net>;

  const { result: poolInstance } = await loadPool(web3, version, poolAddress);

  const collateralTokenAddress = assertIsAddress(
    await poolInstance.instance.methods.collateralToken().call(),
  ) as AddressOn<Net>;

  if (
    collateralTokenAddress.toLowerCase() !== collateralAddress.toLowerCase()
  ) {
    throwError(
      `Collateral token mismatch - expected: '${collateralAddress}', ` +
        `got: '${collateralTokenAddress}'`,
    );
  }

  const syntheticTokenAddress = assertIsAddress(
    await poolInstance.instance.methods.syntheticToken().call(),
  ) as AddressOn<Net>;
  return {
    versionId: version,
    networkId: netId,
    priceFeed: priceFeed[symbol],
    symbol,
    ...poolInstance,
    syntheticToken: await getTokenInfo(web3, syntheticTokenAddress),
    collateralToken: await getTokenInfo(web3, collateralTokenAddress),
    derivative: {
      address: assertIsAddress(
        (await poolInstance.instance.methods.getAllDerivatives().call())[0],
      ) as AddressOn<Net>,
      connect: () => throwError('Unsupported function'),
    },
  };
}
