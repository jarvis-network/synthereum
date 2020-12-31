import { SupportedNetworkName } from '../config';
import { TICFactory, TICInterface } from '../contracts/typechain';
import {
  TokenInfo,
  ContractInfo,
} from '@jarvis-network/web3-utils/eth/contracts/types';
import { Web3On } from '@jarvis-network/web3-utils/eth/web3-instance';
import { ToNetworkId } from '@jarvis-network/web3-utils/eth/networks';
import { SyntheticSymbol } from '../config/data/all-synthetic-asset-symbols';
import { priceFeed } from '../config/data/price-feed';

export type Pools<Net extends SupportedNetworkName> = {
  [Sym in SyntheticSymbol]: SynthereumPool<Net, Sym>;
};

export interface SynthereumRealmWithWeb3<
  Net extends SupportedNetworkName = SupportedNetworkName
> extends SynthereumRealm<Net> {
  web3: Web3On<Net>;
  netId: ToNetworkId<Net>;
}

export interface SynthereumRealm<
  Net extends SupportedNetworkName = SupportedNetworkName
> {
  collateralToken: TokenInfo<Net>;
  ticFactory: TICFactory;
  ticInstances: Pools<Net>;
}

export interface SynthereumPool<
  Net extends SupportedNetworkName = SupportedNetworkName,
  Symbol extends SyntheticSymbol = SyntheticSymbol
> extends ContractInfo<Net, TICInterface> {
  symbol: Symbol;
  priceFeed: typeof priceFeed[Symbol];
  collateralToken: TokenInfo<Net>;
  syntheticToken: TokenInfo<Net>;
}
