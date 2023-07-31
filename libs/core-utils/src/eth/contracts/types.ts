import { AddressOn } from '../address';
import { NetworkName, Web3On } from '../web3-instance';

import { ERC20 } from './typechain/ERC20';
import { BaseContract } from './typechain/types';

export interface TokenInstance<
  Net extends NetworkName,
  TokenSymbol extends string = string,
> extends ContractInstance<Net, ERC20> {
  symbol: TokenSymbol;
  decimals: number;
}

export interface TokenInfo<
  Net extends NetworkName,
  TokenSymbol extends string = string,
> extends ContractInfo<Net, ERC20> {
  symbol: TokenSymbol;
  decimals: number;
}

export interface ContractInstance<
  Net extends NetworkName,
  Contract extends BaseContract,
> extends ContractInfo<Net, Contract> {
  instance: Contract;
}

export interface ContractInfo<
  Net extends NetworkName,
  Contract extends BaseContract,
> {
  address: AddressOn<Net>;
  connect: (web3: Web3On<Net>) => Contract;
}

export type TimestampedTransferEvent = {
  blockNumber: number;
  blockTimestamp: number;
  from: string;
  to: string;
  value: string;
};
