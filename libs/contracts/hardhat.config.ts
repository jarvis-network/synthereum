/* eslint-disable no-constant-condition */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { resolve } from 'path';

import { addPublicNetwork } from '@jarvis-network/hardhat-utils/dist/networks';
import {
  modifiyGetMinimumBuild,
  modifiyVerifyMinimumBuild,
  modifyCompile,
  modifyTest,
  modifyAccounts,
  modifyDeploy,
  compile,
} from '@jarvis-network/hardhat-utils/dist/tasks';

import { TASK_VERIFY_VERIFY, TASK_COMPILE } from '@nomiclabs/hardhat-etherscan/dist/src/constants';
import { task as createOrModifyHardhatTask } from 'hardhat/config';

import { deployFixedRate } from './src/migration-utils/deploy_fixed_rate';

const { KOVAN_PRIVATE_KEY, ALCHEMY_PROJECT_ID } = process.env;

createOrModifyHardhatTask(TASK_VERIFY_VERIFY).setAction(
  (taskArgs, hre, runSuper) => {
    const network = hre.network.name;
    if (network === 'polygon' || network === 'mumbai') {
      (hre.config as any).etherscan.apiKey = process.env.POLYGONSCAN_API_KEY;
    }
    return runSuper();
  },
);

modifiyGetMinimumBuild();
modifiyVerifyMinimumBuild();
modifyCompile(
  require.resolve('./contracts/test/ImportAll.sol'),
  resolve('./deploy'),
);
modifyTest(
  require.resolve('./contracts/test/ImportAll.sol'),
  resolve('./deploy'),
);
modifyAccounts();
modifyDeploy(resolve('.'));
compile();

const TASK_DEPLOY_FIXED_RATE = 'deploy_fixed_rate_currency';

task(TASK_DEPLOY_FIXED_RATE)
  .addParam('jsynth', 'The synthereum peg token address')
  .addParam('collateral', 'The collateral address of the synth peg token')
  .addParam('pool', 'The synthereum pool address')
  .addParam('admin', 'Contract admin address')
  .addParam('rate', 'The exchange rate')
  .addParam('name', 'The fixed rate currency name')
  .addParam('symbol', 'Its symbol')
  .addParam('atomicswap', 'The address of the atomic swap contract')

  // eslint-disable-next-line require-await
  .setAction(async (params, hre) => {
    await hre.run(TASK_COMPILE);

    const FixedRateCurrency = hre.artifacts.require('FixedRateCurrency');
    const SynthereumFinder = hre.artifacts.require('SynthereumFinder');
    const AtomicSwap = hre.artifacts.require('AtomicSwap');

    const address = await deployFixedRate(params, hre.web3, hre.network, {
      FixedRateCurrency,
      SynthereumFinder,
      AtomicSwap,
    });
    console.log('Deployed at: ', address);
  });

export const config = {
  solidity: {
    version: '0.8.4',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  paths: {
    root: '.',
    sources: './deploy',
    artifacts: './artifacts',
    cache: './cache',
    tests: './test',
  },
  networks: {
    hardhat: {
      gas: 11500000,
      blockGasLimit: 11500000,
      allowUnlimitedContractSize: false,
      forking: {
        url: `https://eth-kovan.alchemyapi.io/v2/${ALCHEMY_PROJECT_ID}`,
      },
    },
    kovan: {
      url: `https://eth-kovan.alchemyapi.io/v2/${ALCHEMY_PROJECT_ID}`,
      accounts: [`0x${KOVAN_PRIVATE_KEY}`],
    },
    localhost: {
      url: 'http://127.0.0.1:8545',
    },
  },
  mocha: {
    timeout: 1800000,
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
};

addPublicNetwork(config, 1, process.env.ETHEREUM_PROJECT_ID!);
addPublicNetwork(config, 42, process.env.ETHEREUM_PROJECT_ID!);
addPublicNetwork(config, 4, process.env.ETHEREUM_PROJECT_ID!);
addPublicNetwork(config, 137, process.env.POLYGON_PROJECT_ID!);
addPublicNetwork(config, 80001, process.env.POLYGON_PROJECT_ID!);

export default config;
