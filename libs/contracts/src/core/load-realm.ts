import {
  AddressOn,
  assertIsAddress,
} from '@jarvis-network/web3-utils/eth/address';
import { t } from '@jarvis-network/web3-utils/base/meta';
import { parseInteger } from '@jarvis-network/web3-utils/base/asserts';
import type {
  NetworkName,
  Web3On,
} from '@jarvis-network/web3-utils/eth/web3-instance';
import { getContract } from '@jarvis-network/web3-utils/eth/contracts/get-contract';
import type { ToNetworkId } from '@jarvis-network/web3-utils/eth/networks';

import type { SynthereumPool, SynthereumRealmWithWeb3 } from './types';

import { TICFactory_Abi, TICInterface_Abi, ERC20_Abi } from '../contracts/abi';

import { contractDependencies } from '../config/data/contract-dependencies';
import type {
  ContractDependencies,
  PerAsset,
  SupportedNetworkId,
  SupportedNetworkName,
} from '../config';
import type { TokenInfo } from '@jarvis-network/web3-utils/eth/contracts/types';
import { priceFeed } from '../config/data/price-feed';
import { allSymbols } from '../config/data/all-synthetic-asset-symbols';

/**
 * Load the default Synthereum Realm.
 * @param web3 Web3 instance to connect to
 * @param netId Integer representing one of the supported network ids
 */
export async function loadRealm<Net extends SupportedNetworkName>(
  web3: Web3On<Net>,
  netId: ToNetworkId<Net>,
): Promise<SynthereumRealmWithWeb3<Net>> {
  const config: ContractDependencies =
    contractDependencies[netId as SupportedNetworkId];

  return loadCustomRealm(web3, netId, config);
}

/**
 * Load a custom Synthereum Realm, identified by the `config` parameter.
 * @param web3 Web3 instance to connect to
 * @param config Configuration object containing all of the contract dependencies
 */
export async function loadCustomRealm<Net extends SupportedNetworkName>(
  web3: Web3On<Net>,
  netId: ToNetworkId<Net>,
  config: ContractDependencies,
): Promise<SynthereumRealmWithWeb3<Net>> {
  let ticFactory = getContract(web3, TICFactory_Abi, config.ticFactory);

  const pools = await Promise.all(
    allSymbols.map(async symbol => {
      const ticAddress = assertIsAddress(
        await ticFactory.methods.symbolToTIC(symbol).call(),
      ) as AddressOn<Net>;
      const ticInstance = getContract(web3, TICInterface_Abi, ticAddress);
      const collateralTokenAddress = assertIsAddress(
        await ticInstance.methods.collateralToken().call(),
      ) as AddressOn<Net>;
      const syntheticTokenAddress = assertIsAddress(
        await ticInstance.methods.syntheticToken().call(),
      ) as AddressOn<Net>;
      const info: SynthereumPool<Net> = {
        priceFeed: priceFeed[symbol],
        symbol,
        address: ticAddress,
        instance: ticInstance,
        syntheticToken: await getTokenInfo(web3, syntheticTokenAddress),
        collateralToken: await getTokenInfo(web3, collateralTokenAddress),
      };
      return t(symbol, info);
    }),
  );

  return {
    web3,
    netId,
    ticFactory,
    ticInstances: Object.fromEntries(pools) as PerAsset<SynthereumPool<Net>>,
    // Assume the same collateral token for all synthetics:
    collateralToken: pools[0][1].collateralToken,
  };
}

async function getTokenInfo<Net extends NetworkName>(
  web3: Web3On<Net>,
  address: AddressOn<Net>,
): Promise<TokenInfo<Net>> {
  const instance = getContract(web3, ERC20_Abi, address);
  const symbol = await instance.methods.symbol().call();
  const decimals = parseInteger(await instance.methods.decimals().call());
  return {
    address,
    instance,
    symbol,
    decimals,
  };
}
