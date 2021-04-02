import {
  parseInteger,
  throwError,
} from '@jarvis-network/web3-utils/base/asserts';
import { last } from '@jarvis-network/web3-utils/base/array-fp-utils';
import { t } from '@jarvis-network/web3-utils/base/meta';
import {
  AddressOn,
  assertIsAddress,
  isAddress,
} from '@jarvis-network/web3-utils/eth/address';
import { getContract } from '@jarvis-network/web3-utils/eth/contracts/get-contract';
import type { TokenInfo } from '@jarvis-network/web3-utils/eth/contracts/types';
import type { ToNetworkId } from '@jarvis-network/web3-utils/eth/networks';
import type {
  NetworkName,
  Web3On,
} from '@jarvis-network/web3-utils/eth/web3-instance';

import type {
  SynthereumContractDependencies,
  SyntheticSymbol,
  SupportedNetworkId,
  SupportedNetworkName,
} from '../config';
import { allSyntheticSymbols, priceFeed, synthereumConfig } from '../config';
import { ERC20_Abi, SynthereumPoolRegistry_Abi } from '../contracts/abi';
import { SynthereumPoolRegistry } from '../contracts/typechain';

import { loadPool } from './pool-utils';
import type {
  PoolsForVersion,
  PoolVersion,
  SynthereumPool,
} from './types/pools';
import type { SynthereumRealmWithWeb3 } from './types/realm';

type PoolVersionsToLoad<Net extends SupportedNetworkName> = {
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
  versionsToLoad: PoolVersionsToLoad<Net> = { v1: null, v2: null, v3: null },
): Promise<SynthereumRealmWithWeb3<Net>> {
  const poolRegistry = getContract(
    web3,
    SynthereumPoolRegistry_Abi,
    config.poolRegistry,
  );

  const collateralAddress = config.primaryCollateralToken.address;

  const loadAllPools = async <Version extends PoolVersion>(
    version: Version,
  ) => {
    const pairs = await Promise.all(
      allSyntheticSymbols.map(async symbol => {
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
  const collateralToken = await getTokenInfo(web3, collateralAddress);

  const pools: SynthereumRealmWithWeb3<Net>['pools'] = {};
  for (const i in versionsToLoad) {
    if (!Object.prototype.hasOwnProperty.call(versionsToLoad, i)) continue;
    const version = i as PoolVersion;
    const poolsForVersion = versionsToLoad[version];
    if (typeof poolsForVersion === 'object' && poolsForVersion !== null) {
      continue;
    }

    // eslint-disable-next-line no-await-in-loop
    pools[version] = await loadAllPools(version);
  }

  return {
    web3,
    netId,
    poolRegistry,
    pools,
    // Assume the same collateral token for all synthetics:
    collateralToken,
  };
}

function poolVersionId(version: PoolVersion) {
  return version === 'v1'
    ? 1
    : version === 'v2'
    ? 2
    : version === 'v3'
    ? 3
    : throwError(`'${version}' is not a supported pool version`);
}

export async function loadPoolInfo<
  Version extends PoolVersion,
  SynthSymbol extends SyntheticSymbol,
  Net extends SupportedNetworkName
>(
  web3: Web3On<Net>,
  netId: ToNetworkId<Net>,
  poolRegistry: SynthereumPoolRegistry,
  collateralAddress: AddressOn<Net>,
  version: Version,
  symbol: SynthSymbol,
): Promise<SynthereumPool<Version, Net, SynthSymbol> | null> {
  const versionId = poolVersionId(version);
  const poolAddresses = await poolRegistry.methods
    .getPools(symbol, collateralAddress, versionId)
    .call();

  // Assume the last address in the array is the one we should interact with
  const lastPoolAddress = last(poolAddresses);

  if (!isAddress(lastPoolAddress)) {
    return null;
  }

  const poolAddress = assertIsAddress(lastPoolAddress) as AddressOn<Net>;

  const { result: poolInstance, derivativeAddress } = await loadPool(
    web3,
    version,
    poolAddress,
  );

  const collateralTokenAddress = assertIsAddress(
    await poolInstance.methods.collateralToken().call(),
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
    await poolInstance.methods.syntheticToken().call(),
  ) as AddressOn<Net>;
  return {
    versionId: version,
    networkId: netId,
    priceFeed: priceFeed[symbol],
    symbol,
    address: poolAddress,
    instance: poolInstance,
    syntheticToken: await getTokenInfo(web3, syntheticTokenAddress),
    collateralToken: await getTokenInfo(web3, collateralTokenAddress),
    derivative: {
      address: derivativeAddress.options.address as AddressOn<Net>,
      instance: derivativeAddress,
    },
  };
}

async function getTokenInfo<Net extends NetworkName>(
  web3: Web3On<Net>,
  address: AddressOn<Net>,
): Promise<TokenInfo<Net>> {
  const { instance } = getContract(web3, ERC20_Abi, address);
  const symbol = await instance.methods.symbol().call();
  const decimals = parseInteger(await instance.methods.decimals().call());
  return {
    address,
    instance,
    symbol,
    decimals,
  };
}
