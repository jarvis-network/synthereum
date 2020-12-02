import { PerAsset, SupportedNetworkName } from '../config/types';
import { TICFactory, TIC } from '../contracts/typechain';
import { TokenInfo, ContractInfo } from '@jarvis-network/web3-utils/eth/contracts/types';

export interface SynthereumRealm<Net extends SupportedNetworkName> {
  collateralToken: TokenInfo<Net>;
  ticFactory: TICFactory;
  ticInstances: PerAsset<SynthereumPool<Net>>;
}

export interface SynthereumPool<Net extends SupportedNetworkName>
  extends ContractInfo<Net, TIC> {
  symbol: string;
  collateralToken: TokenInfo<Net>;
  syntheticToken: TokenInfo<Net>;
}
