import { addPublicNetwork } from '@jarvis-network/hardhat-utils/dist/networks';

export const config = {
  solidity: {
    version: '0.6.12',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  paths: {
    sources: './contracts',
    tests: './test',
    cache: './cache',
    artifacts: './artifacts',
  },
  networks: {
    localhost: {
      url: 'http://127.0.0.1:8545',
    },
  },
  mocha: {
    timeout: 1800000,
  },
};

addPublicNetwork(config, 137);
addPublicNetwork(config, 80001);

export default config;
