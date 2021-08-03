import type { Contract } from 'web3-eth-contract';
import type Web3 from 'web3';

// const { artifacts } = require('hardhat');

export async function deployFixedRate(
  args: any,
  web3: Web3,
  network: any,
  artifacts: any,
): Promise<string> {
  const { FixedRateCurrency, SynthereumFinder, AtomicSwap } = artifacts;
  const {
    getExistingInstance,
  } = require('../../dist/migration-utils/deployment');

  const synthereumFinder = await getExistingInstance(web3, SynthereumFinder);
  const atomicSwap = await getExistingInstance(web3, AtomicSwap);

  const accounts = await web3.eth.getAccounts();
  const { getKeysForNetwork } = require('@jarvis-network/uma-common');
  const keys = getKeysForNetwork(network, accounts);

  const fixedRateContract = await FixedRateCurrency.new(
    args.jsynth,
    args.collateral,
    args.pool,
    synthereumFinder.options.address,
    atomicSwap.options.address,
    args.admin,
    args.rate,
    args.name,
    args.symbol,
    { from: keys.deployer },
  );
  return fixedRateContract.address;
}
