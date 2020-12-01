import type { BaseContract } from './eth/contracts/types';
import type { NetworkName, TaggedWeb3 } from './eth/web3-instance';
import { getContract, AbiSource } from './eth/web3';

export class Web3Service<Net extends NetworkName> {
  constructor(public readonly web3: TaggedWeb3<Net>) {}

  async getContract<T extends BaseContract>(
    address: string,
    abiSource: AbiSource = { type: 'etherscan' },
    gas?: {
      gasLimit: number;
      gasPrice: string;
    },
  ): Promise<T> {
    return await getContract(this.web3, address, abiSource, gas);
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
