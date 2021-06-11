import { SynthereumPoolRegistry as SynthereumPoolRegistryContract } from '@jarvis-network/synthereum-contracts/dist/contracts/typechain';
import {
  ContractInfo,
  TokenInfo,
} from '@jarvis-network/core-utils/dist/eth/contracts/types';
import { Web3On } from '@jarvis-network/core-utils/dist/eth/web3-instance';
import { ToNetworkId } from '@jarvis-network/core-utils/dist/eth/networks';

import { SupportedNetworkName } from '../../config';

import { PoolsForVersion, PoolVersion } from './pools';

/**
 * Describes a specifc deployment of all Synthereum contracts on a given network.
 *
 * This is the central point for interaction with all parts of the deployment.
 */
export interface SynthereumRealm<
  Net extends SupportedNetworkName = SupportedNetworkName
> {
  readonly collateralToken: TokenInfo<Net>;
  readonly poolRegistry: ContractInfo<Net, SynthereumPoolRegistryContract>;
  readonly pools: {
    [Version in PoolVersion]?: PoolsForVersion<Version, Net>;
  };
}

/**
 * Synthereum realm with an associated Web3 instance.
 */
export interface SynthereumRealmWithWeb3<
  Net extends SupportedNetworkName = SupportedNetworkName
> extends SynthereumRealm<Net> {
  readonly web3: Web3On<Net>;
  readonly netId: ToNetworkId<Net>;
}
