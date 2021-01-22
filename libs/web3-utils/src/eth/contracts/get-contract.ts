import { BaseContract } from './typechain/types';
import { NetworkName, Web3On } from '../web3-instance';
import type { AbiItem } from 'web3-utils';
import { Tagged } from '../../base/tagged-type';
import { ContractInfo } from './types';
import { AddressOn } from '../address';

export type AbiFor<Contract extends BaseContract> = Tagged<AbiItem[], Contract>;

export function getContract<
  Contract extends BaseContract,
  Net extends NetworkName
>(
  web3: Web3On<Net>,
  abi: AbiFor<Contract>,
  address: AddressOn<Net>,
  gas?: {
    gasLimit: number;
    gasPrice: string;
  },
): ContractInfo<Net, Contract> {
  const instance = (new web3.eth.Contract(abi, address, {
    gas: gas?.gasLimit,
    gasPrice: gas?.gasPrice,
  }) as unknown) as Contract;
  return {
    instance,
    address,
  };
}
