import { PerAsset, SupportedNetworkName } from '../config';
import { TICFactory, TICInterface } from '../contracts/typechain';
import {
  TokenInfo,
  ContractInfo,
} from '@jarvis-network/web3-utils/eth/contracts/types';
import { Web3On } from '@jarvis-network/web3-utils/eth/web3-instance';
import { ToNetworkId } from '@jarvis-network/web3-utils/eth/networks';

export interface SynthereumRealmWithWeb3<Net extends SupportedNetworkName>
  extends SynthereumRealm<Net> {
  web3: Web3On<Net>;
  netId: ToNetworkId<Net>;
}

export interface SynthereumRealm<Net extends SupportedNetworkName> {
  collateralToken: TokenInfo<Net>;
  ticFactory: TICFactory;
  ticInstances: PerAsset<SynthereumPool<Net>>;
}

export interface SynthereumPool<Net extends SupportedNetworkName>
  extends ContractInfo<Net, TICInterface> {
  symbol: string;
  priceFeed: string;
  collateralToken: TokenInfo<Net>;
  syntheticToken: TokenInfo<Net>;
}
