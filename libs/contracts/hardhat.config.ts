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

import { TASK_VERIFY_VERIFY } from '@nomiclabs/hardhat-etherscan/dist/src/constants';

import { task as createOrModifyHardhatTask } from 'hardhat/config';

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
      è,
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
