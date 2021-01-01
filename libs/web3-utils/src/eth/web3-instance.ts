import type Web3 from 'web3';
import type { TagKindOf } from '../base/tagged-type';
import type { Network, NetworkName, ValueOnNetwork } from './networks';

export type Web3On<Net extends Network> = ValueOnNetwork<Web3, Net>;
export type NetworkOf<
  Web3 extends Web3On<NetworkName>
> = TagKindOf<Web3>['network'];
export type { NetworkName };

/**
 * Sets the default account on a web3 instance to a new one specified as a
 * private key.
 *
 * This function **should only be used for development purposes**.
 *
 * @param web3 Web3 instance to set the account on
 * @param privateKey hex-encoded secp256k1 private key
 */
export function setPrivateKey_DevelopmentOnly(web3: Web3, privateKey: string) {
  const account = web3.eth.accounts.privateKeyToAccount(privateKey);
  web3.eth.accounts.wallet.add(account);
  web3.eth.defaultAccount = account.address;
  web3.defaultAccount = account.address;
}
