/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { resolve } from 'path';

import { addPublicNetwork } from '@jarvis-network/hardhat-utils/dist/networks';

import '@nomiclabs/hardhat-truffle5';
import 'solidity-coverage';
import 'hardhat-gas-reporter';
import '@nomiclabs/hardhat-web3';
import '@nomiclabs/hardhat-etherscan';
import { task, task as createOrModifyHardhatTask } from 'hardhat/config';

import {
  modifiyGetMinimumBuild,
  modifiyVerifyMinimumBuild,
  modifyCompile,
  modifyTest,
  modifyAccounts,
  modifyDeploy,
  compile,
} from '@jarvis-network/hardhat-utils/dist/tasks';

import { TASK_COMPILE } from 'hardhat/builtin-tasks/task-names';

import { TASK_VERIFY_VERIFY } from '@nomiclabs/hardhat-etherscan/dist/src/constants';

import { deployFixedRate } from './src/migration-utils/deploy_fixed_rate';

require('dotenv').config();

// const { KOVAN_PRIVATE_KEY, ALCHEMY_PROJECT_ID } = process.env;

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
  .addParam('finder', 'Synthereum finder address')

  // eslint-disable-next-line require-await
  .setAction(async (params, hre) => {
    await hre.run(TASK_COMPILE);
    const FixedRateCurrency = hre.artifacts.require('FixedRateCurrency');
    const address = await deployFixedRate(params, hre.web3, hre.network, {
      FixedRateCurrency,
    });
    console.log('Deployed at: ', address);
  });

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

const config = {
  solidity: {
    version: '0.8.4',
    settings: {
      optimizer: { enabled: true, runs: 200 },
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
    },
    localhost: {
      url: 'http://127.0.0.1:8545',
    },
  },
  mocha: {
    timeout: 1800000,
  },
  etherscan: {
    apiKey: process.env.POLYGONSCAN_API_KEY,
  },
};

addPublicNetwork(config, 1, process.env.ETHEREUM_PROJECT_ID!);
addPublicNetwork(config, 42, process.env.ETHEREUM_PROJECT_ID!);
addPublicNetwork(config, 4, process.env.ETHEREUM_PROJECT_ID!);
addPublicNetwork(config, 80001, process.env.POLYGON_PROJECT_ID!);
addPublicNetwork(config, 137, process.env.POLYGON_PROJECT_ID!);

export default config;