import { BaseContract } from './typechain/types';
import { TaggedWeb3, NetworkName } from '../web3-instance';
import type { AbiItem } from 'web3-utils';
import { Tagged } from '../../base/tagged-type';

export type AbiFor<Contract extends BaseContract> = Tagged<AbiItem[], Contract>;

export function getContract<
  Contract extends BaseContract,
  Net extends NetworkName
>(
  web3: TaggedWeb3<Net>,
  abi: AbiFor<Contract>,
  address: string,
  gas?: {
    gasLimit: number;
    gasPrice: string;
  },
): Contract {
  return (new web3.eth.Contract(abi, address, {
    gas: gas?.gasLimit,
    gasPrice: gas?.gasPrice,
  }) as unknown) as Contract;
}
