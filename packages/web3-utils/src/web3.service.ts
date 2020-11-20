import type Web3 from 'web3';
import { getWeb3, Web3Source } from './eth/web3-instance';
import { getContract, AbiSource } from './eth/web3';
import type { BaseContract } from './contracts/types';

export class Web3Service {
  public readonly web3: Web3;

  constructor(web3OrNetwork: Web3Source) {
    this.web3 = getWeb3(web3OrNetwork);
  }

  async getContract<T extends BaseContract>(
    address: string,
    abiSource: AbiSource = { type: 'etherscan' },
    gas?: {
      gasLimit: number;
      gasPrice: string;
    },
  ): Promise<T> {
    return await getContract<T>(address, this.web3, abiSource, gas);
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
