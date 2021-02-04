const { getHardhatConfig } = require('@jarvis-network/uma-common');

const configOverride = {
  paths: {
    root: '.',
    sources: './contracts',
    artifacts: './artifacts',
    cache: './cache',
    tests: './test',
  },
};

const config = getHardhatConfig(configOverride);
config.solidity.settings.optimizer.runs = 200;
config.networks['mainnet_fork'].timeout = 60000;
config.networks['mainnet'].timeout = 120000;
module.exports = config;
