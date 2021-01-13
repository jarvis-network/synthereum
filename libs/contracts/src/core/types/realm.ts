import { TokenInfo } from '@jarvis-network/web3-utils/eth/contracts/types';
import { Web3On } from '@jarvis-network/web3-utils/eth/web3-instance';
import { ToNetworkId } from '@jarvis-network/web3-utils/eth/networks';
import { SupportedNetworkName } from '../../config';
import { PoolsForVersion, PoolVersion } from './pools';
import { SynthereumPoolRegistry as SynthereumPoolRegistry_Contract } from '../../contracts/typechain';

/**
 * Describes a specifc deployment of all Synthereum contracts on a given network.
 *
 * This is the central point for interaction with all parts of the deployment.
 */
export interface SynthereumRealm<
  Net extends SupportedNetworkName = SupportedNetworkName
> {
  readonly collateralToken: TokenInfo<Net>;
  readonly poolRegistry: SynthereumPoolRegistry_Contract;
  readonly pools: {
    [Version in PoolVersion]: PoolsForVersion<Version, Net>;
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
