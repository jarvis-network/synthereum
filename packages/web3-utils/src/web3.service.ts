import type { BaseContract } from './eth/contracts/types';
import type { NetworkName, TaggedWeb3 } from './eth/web3-instance';
import { getContract } from './eth/contracts/get-contract';
import { AbiFor } from './eth/contracts/get-contract';

export class Web3Service<Net extends NetworkName> {
  constructor(public readonly web3: TaggedWeb3<Net>) {}

  getContract<Contract extends BaseContract>(
    address: string,
    abi: AbiFor<Contract>,
    gas?: {
      gasLimit: number;
      gasPrice: string;
    },
  ): Contract {
    return getContract<Contract, Net>(this.web3, abi, address, gas);
  }

  getDefaultAccount() {
    return this.web3.eth.defaultAccount;
  }

  getTransactionReceipt(txHash: string) {
    return this.web3.eth.getTransactionReceipt(txHash);
  }

  setPrivateKey(privateKey: string) {
    const account = this.web3.eth.accounts.privateKeyToAccount(privateKey);
    this.web3.eth.accounts.wallet.add(account);
    this.web3.eth.defaultAccount = account.address;
  }
}
