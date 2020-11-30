import Web3 from 'web3';
import { NetworkName } from './networks';
import { Tagged, TagOf } from '../base/tagged-type';

export type TaggedWeb3<Net extends NetworkName> = Tagged<Web3, Net>;
export type NetworkOf<Web3 extends TaggedWeb3<NetworkName>> = TagOf<Web3>;
export type { NetworkName };
