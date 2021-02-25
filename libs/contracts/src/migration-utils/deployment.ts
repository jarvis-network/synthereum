import { last } from '@jarvis-network/web3-utils/base/array-fp-utils';
import type Web3 from 'web3';

export async function getExistingInstance(
  web3: Web3,
  artifact: any,
) {
  const networkId = await web3.eth.net.getId();
  let address: string;
  try {
    const contractInstance = await artifact.deployed();
    address = contractInstance.address;
  } catch (e) {
    const { contractName } = artifact;
    const networks = require(`../../../networks/${networkId}.json`);
    address = last(
      networks.filter((contract: any) => {
        return contract.contractName === contractName;
      }),
    ).address;
    console.log(`Using existing deployed instance: ${contractName}@${address}`);
  }
  return new web3.eth.Contract(artifact.abi, address);
}
