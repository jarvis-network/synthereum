import {
  AddressOn,
  assertIsAddress,
  isAddress,
} from '@jarvis-network/web3-utils/eth/address';
import { t } from '@jarvis-network/web3-utils/base/meta';
import {
  parseInteger,
  throwError,
} from '@jarvis-network/web3-utils/base/asserts';
import type {
  NetworkName,
  Web3On,
} from '@jarvis-network/web3-utils/eth/web3-instance';
import { getContract } from '@jarvis-network/web3-utils/eth/contracts/get-contract';
import type { ToNetworkId } from '@jarvis-network/web3-utils/eth/networks';

import type {
  PoolsForVersion,
  PoolVersion,
  SynthereumPool,
} from './types/pools';
import type { SynthereumRealmWithWeb3 } from './types/realm';

import { SynthereumPoolRegistry_Abi, ERC20_Abi } from '../contracts/abi';

import { contractDependencies } from '../config/data/contract-dependencies';
import type {
  ContractDependencies,
  SupportedNetworkId,
  SupportedNetworkName,
} from '../config';
import type {
  ContractInfo,
  TokenInfo,
} from '@jarvis-network/web3-utils/eth/contracts/types';
import { priceFeed } from '../config/data/price-feed';
import {
  allSupportedSymbols,
  SyntheticSymbol,
} from '../config/data/all-synthetic-asset-symbols';
import { getPool } from './pool-utils';
import { SynthereumPoolRegistry } from '../contracts/typechain';

/**
 * Load the default Synthereum Realm.
 * @param web3 Web3 instance to connect to
 * @param netId Integer representing one of the supported network ids
 */
export async function loadRealm<Net extends SupportedNetworkName>(
  web3: Web3On<Net>,
  netId: ToNetworkId<Net>,
): Promise<SynthereumRealmWithWeb3<Net>> {
  const config = contractDependencies[
    netId as SupportedNetworkId
  ] as ContractDependencies<Net>;

  return loadCustomRealm(web3, netId, config);
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
  config: ContractDependencies<Net>,
): Promise<SynthereumRealmWithWeb3<Net>> {
  let poolRegistry = getContract(
    web3,
    SynthereumPoolRegistry_Abi,
    config.poolRegistry,
  );

  const collateralAddress = config.collateralAddress;

  const loadAllPools = async (version: PoolVersion) => {
    const pairs = await Promise.all(
      allSupportedSymbols.map(async symbol => {
        const info = await loadPoolInfo(
          web3,
          poolRegistry.instance,
          collateralAddress,
          version,
          symbol,
        );
        return t(symbol, info);
      }),
    );

    return Object.fromEntries(pairs);
  };

  return {
    web3,
    netId,
    poolRegistry,
    pools: {
      v1: (await loadAllPools('v1')) as PoolsForVersion<'v1', Net>,
      v2: (await loadAllPools('v2')) as PoolsForVersion<'v2', Net>,
    },
    // Assume the same collateral token for all synthetics:
    collateralToken: await getTokenInfo(web3, collateralAddress),
  };
}

function poolVersionId(version: PoolVersion) {
  return version === 'v1'
    ? 1
    : version === 'v2'
    ? 2
    : throwError(`'${version}' is not a supported pool version`);
}

export async function loadPoolInfo<
  Version extends PoolVersion,
  Symbol extends SyntheticSymbol,
  Net extends SupportedNetworkName
>(
  web3: Web3On<Net>,
  poolRegistry: SynthereumPoolRegistry,
  collateralAddress: AddressOn<Net>,
  version: Version,
  symbol: Symbol,
): Promise<SynthereumPool<Version, Net, Symbol> | null> {
  const versionId = poolVersionId(version);
  const poolAddresses = await poolRegistry.methods
    .getPools(symbol, collateralAddress, versionId)
    .call();

  // Assume the last address in the array is the one we should interact with
  const lastPoolAddress = poolAddresses[poolAddresses.length - 1];

  if (!isAddress(lastPoolAddress)) {
    return null;
  }

  const poolAddress = assertIsAddress(lastPoolAddress) as AddressOn<Net>;

  const poolInstance = getPool(web3, version, poolAddress);

  const collateralTokenAddress = assertIsAddress(
    await poolInstance.methods.collateralToken().call(),
  ) as AddressOn<Net>;

  if (collateralTokenAddress !== collateralAddress) {
    throwError(
      `Collateral token mismatch - expected: '${collateralAddress}', ` +
        `got: '${collateralTokenAddress}'`,
    );
  }

  const syntheticTokenAddress = assertIsAddress(
    await poolInstance.methods.syntheticToken().call(),
  ) as AddressOn<Net>;

  return {
    priceFeed: priceFeed[symbol],
    symbol,
    address: poolAddress,
    instance: poolInstance,
    syntheticToken: await getTokenInfo(web3, syntheticTokenAddress),
    collateralToken: await getTokenInfo(web3, collateralTokenAddress),
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
