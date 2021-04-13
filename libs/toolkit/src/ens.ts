import Web3 from 'web3';
import { assertNotNull } from '@jarvis-network/core-utils/dist/base/asserts';
import {
  Address,
  assertIsAddress,
} from '@jarvis-network/core-utils/dist/eth/address';
import { getOrCreateElementAsync } from '@jarvis-network/core-utils/dist/base/optional';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const namehash = require('eth-ens-namehash');

export class ENSHelper {
  private web3: Web3;

  private prettyCache: Map<string, string> = new Map();

  constructor(web3: Web3) {
    this.web3 = web3;
  }

  reverse = async (address: Address) => {
    const addr = `${address.substr(2).toLowerCase()}.addr.reverse`;
    const hash = namehash.hash(addr);

    const contract = await this.web3.eth.ens.getResolver(addr);
    return assertIsAddress(await contract.methods.name(hash).call());
  };

  prettyName = (address: Address): Promise<string> =>
    getOrCreateElementAsync(this.prettyCache, address, async () => {
      const reverseName = await this.reverse(address);
      const ownerAddress = assertNotNull(
        await this.web3.eth.ens.getOwner(reverseName),
      );
      if (ownerAddress && ownerAddress.toLowerCase() === address) {
        this.prettyCache.set(address, reverseName);
      }
      return reverseName;
    });
}
