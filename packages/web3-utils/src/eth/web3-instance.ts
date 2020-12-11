import type Web3 from 'web3';
import type { Network, NetworkName, ValueOnNetwork } from './networks';
import type { TagKindOf } from '../base/tagged-type';

export type Web3On<Net extends Network> = ValueOnNetwork<Web3, Net>;
export type NetworkOf<Web3 extends Web3On<NetworkName>> = TagKindOf<Web3>['network'];
export type { NetworkName };
