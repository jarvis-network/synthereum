/* eslint-disable no-constant-condition */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { resolve } from 'path';

import '@nomiclabs/hardhat-ethers';

import {
  addPublicNetwork,
  setForkingUrl,
} from '@jarvis-network/hardhat-utils/dist/networks';
import { addEtherscanApiKeys } from '@jarvis-network/hardhat-utils/dist/etherscan';
import {
  modifiyGetMinimumBuild,
  modifiyVerifyMinimumBuild,
  modifyCompile,
  modifyTest,
  modifyAccounts,
  modifyDeploy,
  compile,
} from '@jarvis-network/hardhat-utils/dist/tasks';

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
    compilers: [
      {
        version: '0.8.9',
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    ],
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
    timeout: 18000000,
  },
};

addEtherscanApiKeys(config);

addPublicNetwork(config, 1, process.env.ETHEREUM_PROJECT_ID!);
addPublicNetwork(config, 3, process.env.ETHEREUM_PROJECT_ID!);
addPublicNetwork(config, 4, process.env.ETHEREUM_PROJECT_ID!);
addPublicNetwork(config, 42, process.env.ETHEREUM_PROJECT_ID!);
addPublicNetwork(config, 56);
addPublicNetwork(config, 77);
addPublicNetwork(config, 97);
addPublicNetwork(config, 100);
addPublicNetwork(config, 137, process.env.POLYGON_PROJECT_ID!);
addPublicNetwork(config, 250);
addPublicNetwork(config, 4002);
addPublicNetwork(config, 80001, process.env.POLYGON_PROJECT_ID!);
addPublicNetwork(config, 43113);
addPublicNetwork(config, 43114);
addPublicNetwork(config, 420, process.env.OPTIMISM_GOERLI_PROJECT_ID!);

// set hardat forking for public testnets
if (process.env.FORKCHAINID) {
  setForkingUrl(
    config,
    parseInt(process.env.FORKCHAINID, 10),
    process.env.BLOCK ? parseInt(process.env.BLOCK, 10) : undefined,
  );
}

export default config;
