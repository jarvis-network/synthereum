import Web3 from 'web3';
import namehash from 'eth-ens-namehash';

export class ENSHelper {
  private web3: Web3;

  private prettyCache: Map<string, string> = new Map();

  constructor(web3: Web3) {
    this.web3 = web3;
  }

  reverse = async (address: string) => {
    if (!address) {
      return null;
    }
    const addr = `${address.substr(2).toLowerCase()}.addr.reverse`;
    const hash = namehash.hash(addr);

    const contract = await this.web3.eth.ens.getResolver(addr);
    const name = await contract.methods.name(hash).call();
    return name ? String(name) : null;
  };

  prettyName = async (address: string) => {
    if (this.prettyCache.has(address)) {
      return this.prettyCache.get(address);
    }

    let reverseName: string;
    let ownerAddress: string;

    try {
      reverseName = await this.reverse(address);
      ownerAddress = await this.web3.eth.ens.getOwner(reverseName);
    } catch (error) {
      reverseName = null;
      ownerAddress = null;
    }

    if (ownerAddress && ownerAddress.toLowerCase() === address) {
      this.prettyCache.set(address, reverseName);
    } else {
      this.prettyCache.set(address, null);
    }

    return this.prettyCache.get(address);
  };
}
