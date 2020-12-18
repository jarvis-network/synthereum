import { AddressOn } from '../address';
import { NetworkName } from '../web3-instance';
import { ERC20 } from './typechain/ERC20';
import { BaseContract } from './typechain/types';

export interface TokenInfo<Net extends NetworkName>
  extends ContractInfo<Net, ERC20> {
  symbol: string;
  decimals: number;
}

export interface ContractInfo<
  Net extends NetworkName,
  Contract extends BaseContract
> {
  address: AddressOn<Net>;
  instance: Contract;
}

export type TimestampedTransferEvent = {
  blockNumber: number;
  blockTimestamp: number;
  from: string;
  to: string;
  value: string;
};
