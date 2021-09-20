import {
  ISynthereumRegistry_Abi,
  SelfMintingPerpetualMultiParty_Abi,
} from '@jarvis-network/synthereum-contracts/dist/contracts/abi';
import {
  ISynthereumRegistry,
  SelfMintingPerpetualMultiParty,
} from '@jarvis-network/synthereum-contracts/dist/contracts/typechain';
import {
  parseInteger,
  throwError,
} from '@jarvis-network/core-utils/dist/base/asserts';
import { last } from '@jarvis-network/core-utils/dist/base/array-fp-utils';
import {
  AddressOn,
  assertIsAddress,
} from '@jarvis-network/core-utils/dist/eth/address';
import { getContract } from '@jarvis-network/core-utils/dist/eth/contracts/get-contract';
import type { ToNetworkId } from '@jarvis-network/core-utils/dist/eth/networks';
import type { Web3On } from '@jarvis-network/core-utils/dist/eth/web3-instance';
import { scaleTokenAmountToWei } from '@jarvis-network/core-utils/dist/eth/contracts/erc20';

import { t } from '@jarvis-network/core-utils/dist/base/meta';

import {
  CollateralOf,
  ExchangeSelfMintingToken,
  SupportedNetworkId,
  SupportedNetworkName,
  SupportedSelfMintingPairExact,
  SupportedSelfMintingSymbol,
  synthereumConfig,
  SynthereumContractDependencies,
  SyntheticSymbolOf,
} from '@jarvis-network/synthereum-config';

import {
  ContractInstance,
  TokenInstance,
} from '@jarvis-network/core-utils/dist/eth/contracts/types';

import { Amount, wei } from '@jarvis-network/core-utils/dist/base/big-number';

import type { SelfMintingRealmWithWeb3 } from '../../types/realm';

import {
  DerivativesForVersion,
  SelfMintingDerivative,
  SelfMintingDerivativeData,
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
): Promise<SelfMintingRealmWithWeb3<Net>> {
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
): Promise<SelfMintingRealmWithWeb3<Net>> {
  const selfMintingRegistry = getContract(
    web3,
    ISynthereumRegistry_Abi,
    config.selfMintingRegistry,
  );
  const tokens: {
    // eslint-disable-next-line
    [Token in ExchangeSelfMintingToken]?: TokenInstance<Net, Token> | {};
  } = {};

  const loadAllDerivatives = async <Version extends SelfMintingVersion>(
    version: Version,
  ) => {
    const syntheticTokens = (await selfMintingRegistry.instance.methods
      .getSyntheticTokens()
      .call()) as SupportedSelfMintingSymbol<Net>[];
    const collateralTokens = (await selfMintingRegistry.instance.methods
      .getCollaterals()
      .call()) as AddressOn<Net>[];
    const pairs = (
      await Promise.all(
        collateralTokens.flatMap(async collateralTokenAddress => {
          const collateralToken = (await getTokenInfo(
            web3,
            collateralTokenAddress,
          )) as TokenInstance<Net, ExchangeSelfMintingToken>;
          tokens[collateralToken.symbol] = collateralToken;
          return Promise.all(
            syntheticTokens.map(async symbol => {
              const info = await loadDerivativesInfo(
                web3,
                netId,
                selfMintingRegistry.instance,
                collateralTokenAddress,
                version,
                `${symbol}/${collateralToken.symbol}` as SupportedSelfMintingPairExact<Net>,
              );
              tokens[info.static.syntheticToken.symbol] =
                info.static.syntheticToken;
              return t(
                `${symbol}/${collateralToken.symbol}` as SupportedSelfMintingPairExact<Net>,
                info,
              );
            }),
          );
        }),
      )
    ).flat();
    return (Object.fromEntries(pairs) as unknown) as DerivativesForVersion<
      Version,
      Net
    >;
  };

  return {
    web3,
    netId,
    tokens,
    selfMintingRegistry,
    selfMintingDerivatives: {
      v1: await loadAllDerivatives('v1'),
    },
  };
}

export async function loadDerivativesInfo<
  Version extends SelfMintingVersion,
  Pair extends SupportedSelfMintingPairExact<Net>,
  Net extends SupportedNetworkName
>(
  web3: Web3On<Net>,
  netId: ToNetworkId<Net>,
  derivativesRegistry: ISynthereumRegistry,
  collateralAddress: AddressOn<Net>,
  version: Version,
  pair: Pair,
): Promise<SelfMintingDerivative<Version, Net, Pair>> {
  const versionId = parseInteger(version.slice(1));
  const synthSymbol = pair.split('/')[0];
  const derivativeAddresses = await derivativesRegistry.methods
    .getElements(synthSymbol, collateralAddress, versionId)
    .call();
  // Assume the last address in the array is the one we should interact with
  const lastDerivativeAddress = assertIsAddress(last(derivativeAddresses));

  const derivativeAddress = assertIsAddress(
    lastDerivativeAddress,
  ) as AddressOn<Net>;

  const derivative = getContract(
    web3,
    SelfMintingPerpetualMultiParty_Abi,
    derivativeAddress,
  );

  const collateralTokenAddress = assertIsAddress(
    await derivative.instance.methods.collateralCurrency().call(),
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
    await derivative.instance.methods.tokenCurrency().call(),
  ) as AddressOn<Net>;

  const syntheticToken = await getTokenInfo<SyntheticSymbolOf<Pair>, Net>(
    web3,
    syntheticTokenAddress,
  );
  const collateralToken = await getTokenInfo<CollateralOf<Pair>, Net>(
    web3,
    collateralTokenAddress,
  );

  return {
    address: derivative.address,
    connect: derivative.connect,
    instance: derivative.instance,
    static: {
      versionId: version,
      networkId: netId,
      pair,
      syntheticToken,
      collateralToken,
      ...derivative,
    },
    dynamic: await getDerivativeData(
      derivative,
      collateralToken,
      syntheticToken,
    ),
  };
}

export async function getDerivativeData<
  Pair extends SupportedSelfMintingPairExact<Net>,
  Net extends SupportedNetworkName
>(
  derivate: ContractInstance<Net, SelfMintingPerpetualMultiParty>,
  collateralToken: TokenInstance<Net, CollateralOf<Pair>>,
  syntheticToken: TokenInstance<Net, SyntheticSymbolOf<Pair>>,
): Promise<SelfMintingDerivativeData> {
  const [fp, cdr, cr, cma, tto, tpo] = await Promise.all([
    derivate.instance.methods.daoFee().call(),
    derivate.instance.methods.capDepositRatio().call(),
    derivate.instance.methods.liquidatableData().call(),
    derivate.instance.methods.capMintAmount().call(),
    derivate.instance.methods.totalTokensOutstanding().call(),
    derivate.instance.methods.totalPositionCollateral().call(),
  ]);

  const feePercentage = wei(fp.feePercentage) as Amount;
  const capDepositRatio = wei(cdr) as Amount;
  const collateralRequirement = wei(cr.collateralRequirement[0]) as Amount;
  const capMintAmount = wei(cma) as Amount;

  const totalTokensOutstanding = scaleTokenAmountToWei({
    amount: wei(tto),
    decimals: syntheticToken.decimals,
  });
  const totalPositionCollateral = scaleTokenAmountToWei({
    amount: wei(tpo),
    decimals: collateralToken.decimals,
  });

  return {
    totalPositionCollateral,
    totalTokensOutstanding,
    capDepositRatio,
    capMintAmount,
    feePercentage,
    collateralRequirement,
  };
}
