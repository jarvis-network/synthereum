import type Web3 from 'web3';
import type { AbiItem } from 'web3-utils';
import type { Contract } from 'web3-eth-contract';
import { getWeb3, Web3Source } from './infura';

export class Web3Service {
  public readonly web3: Web3;

  constructor(web3OrNetwork: Web3Source) {
    this.web3 = getWeb3(web3OrNetwork);
  }

  getContract<T extends Contract>(address: string, abi: AbiItem[]): Contract {
    return new this.web3.eth.Contract(abi, address) as T;
  }
}
