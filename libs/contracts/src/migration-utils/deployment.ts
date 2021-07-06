/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { last } from '@jarvis-network/core-utils/dist/base/array-fp-utils';
import type Web3 from 'web3';
import type { Contract } from 'web3-eth-contract';

export async function getExistingInstance(
  web3: Web3,
  artifact: any,
): Promise<Contract> {
  const networkId = await web3.eth.net.getId();
  let address: string;
  try {
    const contractInstance = await artifact.deployed();
    address = contractInstance.address;
  } catch (e) {
    const { contractName } = artifact;
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const networks = require(`../../networks/${networkId}.json`);
    address = last(
      networks.filter(
        (contract: any) => contract.contractName === contractName,
      ),
    ).address;
    console.log(`Using existing deployed instance: ${contractName}@${address}`);
  }
  return new web3.eth.Contract(artifact.abi, address);
}
