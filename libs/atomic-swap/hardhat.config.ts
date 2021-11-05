/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {
  addPublicNetwork,
  setForkingUrl,
} from '@jarvis-network/hardhat-utils/dist/networks';

import '@nomiclabs/hardhat-truffle5';
import 'solidity-coverage';
import 'hardhat-gas-reporter';
import '@nomiclabs/hardhat-web3';
import '@nomiclabs/hardhat-etherscan';

require('dotenv').config();

const config = {
  solidity: {
    version: '0.8.4',
    settings: {
      optimizer: { enabled: true, runs: 200 },
    },
  },
  paths: {
    root: '.',
    sources: './contracts',
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

// set hardat forking
if (process.env.FORKCHAINID !== undefined) {
  setForkingUrl(config, parseInt(process.env.FORKCHAINID, 10));
}

addPublicNetwork(config, 1, process.env.ETHEREUM_PROJECT_ID!);
addPublicNetwork(config, 42, process.env.ETHEREUM_PROJECT_ID!);
addPublicNetwork(config, 4, process.env.ETHEREUM_PROJECT_ID!);
addPublicNetwork(config, 80001, process.env.POLYGON_PROJECT_ID!);
addPublicNetwork(config, 137, process.env.POLYGON_PROJECT_ID!);

export default config;
