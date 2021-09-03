import {
  ISynthereumRegistry_Abi,
  SelfMintingPerpetualMultiParty_Abi,
} from '@jarvis-network/synthereum-contracts/dist/contracts/abi';
import { ISynthereumRegistry } from '@jarvis-network/synthereum-contracts/dist/contracts/typechain';
import {
  parseInteger,
  throwError,
} from '@jarvis-network/core-utils/dist/base/asserts';
import { last } from '@jarvis-network/core-utils/dist/base/array-fp-utils';
import {
  AddressOn,
  assertIsAddress,
  isAddress,
} from '@jarvis-network/core-utils/dist/eth/address';
import { getContract } from '@jarvis-network/core-utils/dist/eth/contracts/get-contract';
import type { ToNetworkId } from '@jarvis-network/core-utils/dist/eth/networks';
import type { Web3On } from '@jarvis-network/core-utils/dist/eth/web3-instance';

import { t } from '@jarvis-network/core-utils/dist/base/meta';

import {
  priceFeed,
  SupportedNetworkId,
  SupportedNetworkName,
  SupportedSelfMintingSymbol,
  synthereumConfig,
  SynthereumContractDependencies,
} from '@jarvis-network/synthereum-config';

import type { SynthereumRealmWithWeb3 } from '../../types/realm';

import {
  DerivativesForVersion,
  SelfMintingDerivative,
  SelfMintingVersion,
} from '../../types/self-minting-derivatives';

import { getTokenInfo } from '../comman-realm';

export type SelfMintingVersionsToLoad<Net extends SupportedNetworkName> = {
  [Version in SelfMintingVersion]?: DerivativesForVersion<Version, Net> | null;
};

export function loadRealm<Net extends SupportedNetworkName>(
  web3: Web3On<Net>,
  netId: ToNetworkId<Net>,
  versionsToLoad?: SelfMintingVersionsToLoad<Net>,
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
  _versionsToLoad: SelfMintingVersionsToLoad<Net> = { v1: null },
): Promise<SynthereumRealmWithWeb3<Net>> {
  const selfMintingRegistry = getContract(
    web3,
    ISynthereumRegistry_Abi,
    config.selfMintingRegistry,
  );

  const loadAllDerivatives = async <Version extends SelfMintingVersion>(
    version: Version,
  ) => {
    const syntheticTokens = (await selfMintingRegistry.instance.methods
      .getSyntheticTokens()
      .call()) as SupportedSelfMintingSymbol<Net>[];
    const collateralTokens = (await selfMintingRegistry.instance.methods
      .getCollaterals()
      .call()) as AddressOn<Net>[];
    const pairs = await Promise.all(
      collateralTokens.flatMap(collateralTokenAddress =>
        syntheticTokens.map(async symbol => {
          const info = await loadDerivativesInfo(
            web3,
            netId,
            selfMintingRegistry.instance,
            collateralTokenAddress,
            version,
            symbol,
          );
          return t(symbol, info);
        }),
      ),
    );
    return Object.fromEntries(pairs) as DerivativesForVersion<Version, Net>;
  };

  return {
    web3,
    netId,
    selfMintingRegistry,
    selfMintingDerivatives: {
      v1: await loadAllDerivatives('v1'),
    },
    poolRegistry: undefined,
    pools: undefined,
  };
}

export async function loadDerivativesInfo<
  Version extends SelfMintingVersion,
  SynthSymbol extends SupportedSelfMintingSymbol<Net>,
  Net extends SupportedNetworkName
>(
  web3: Web3On<Net>,
  netId: ToNetworkId<Net>,
  derivativesRegistry: ISynthereumRegistry,
  collateralAddress: AddressOn<Net>,
  version: Version,
  symbol: SynthSymbol,
): Promise<SelfMintingDerivative<Version, Net, SynthSymbol> | null> {
  const versionId = parseInteger(version.slice(1));
  const derivativeAddresses = await derivativesRegistry.methods
    .getElements(symbol, collateralAddress, versionId)
    .call();
  // Assume the last address in the array is the one we should interact with
  const lastDerivativeAddress = last(derivativeAddresses);

  if (!isAddress(lastDerivativeAddress)) {
    return null;
  }

  const derivativeAddress = assertIsAddress(
    lastDerivativeAddress,
  ) as AddressOn<Net>;

  const { instance } = await getContract(
    web3,
    SelfMintingPerpetualMultiParty_Abi,
    derivativeAddress,
  );

  const collateralTokenAddress = assertIsAddress(
    await instance.methods.collateralCurrency().call(),
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
    await instance.methods.tokenCurrency().call(),
  ) as AddressOn<Net>;
  return {
    versionId: version,
    networkId: netId,
    priceFeed: priceFeed[symbol],
    symbol,
    address: derivativeAddress,
    instance,
    syntheticToken: await getTokenInfo(web3, syntheticTokenAddress),
    collateralToken: await getTokenInfo(web3, collateralTokenAddress),
  };
}
