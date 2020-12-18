import { Network } from '@jarvis-network/web3-utils/eth/networks';
import { keccak256, soliditySha3Raw, utf8ToHex } from 'web3-utils';
const Web3EthAbi = require('web3-eth-abi');
// Read more: https://medium.com/metamask/eip712-is-coming-what-to-expect-and-how-to-use-it-bb92fd1a7a26
export class EIP712DomainLib {
  static getDomainTypes(): string[] {
    return ['bytes32', 'bytes32', 'bytes32', 'uint256', 'address'];
  }
  public static signature_name =
    'EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)';
  public static generateMessage(
    name: string,
    version: string,
    chainId: Network,
    address: string,
  ): string {
    const domainSeparatorBodyTypes = EIP712DomainLib.getDomainTypes();
    const domainSeparatorBodyParametres = [
      keccak256(EIP712DomainLib.signature_name),
      keccak256(utf8ToHex(name)),
      keccak256(utf8ToHex(version)),
      chainId,
      address,
    ];
    const domainSeparatorBody = Web3EthAbi.encodeParameters(
      domainSeparatorBodyTypes,
      domainSeparatorBodyParametres,
    );
    return soliditySha3Raw(domainSeparatorBody).replace('0x', '');
  }
}
