import type { AbiItem } from 'web3-utils';

import { NetworkName, Web3On } from '../web3-instance';
import { Tagged } from '../../base/tagged-type';

import { AddressOn } from '../address';

import { ContractInstance } from './types';
import { BaseContract } from './typechain/types';

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
): ContractInstance<Net, Contract> {
  const connect = (web3_: Web3On<Net>) =>
    (new web3_.eth.Contract(abi, address, {
      gas: gas?.gasLimit,
      gasPrice: gas?.gasPrice,
    }) as unknown) as Contract;
  return {
    connect,
    instance: connect(web3),
    address,
  };
}
