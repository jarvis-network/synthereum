const web3Utils = require('web3-utils');
const rolesConfig = require('../../contracts/data/roles.json');
const { artifacts } = require('hardhat');
const {
  getExistingInstance,
} = require('@jarvis-network/hardhat-utils/dist/deployment/get-existing-instance');
const {
  ZERO_ADDRESS,
} = require('@jarvis-network/hardhat-utils/dist/deployment/migrationUtils');
const MoneyMarketManager = artifacts.require('MoneyMarketManager');

const { toNetworkId } = require('@jarvis-network/core-utils/dist/eth/networks');
const {
  getKeysForNetwork,
  deploy,
} = require('@jarvis-network/hardhat-utils/dist/deployment/migrationUtils');

module.exports = async function (deployer, network, accounts) {
  const networkId = process.env.FORKCHAINID
    ? process.env.FORKCHAINID
    : toNetworkId(network);
  const networkFile = require(`@jarvis-network/synthereum-contracts/networks/${networkId}.json`);
  console.log(networkId, network);

  global.web3 = web3;
  const synthereumFinderAddress = networkFile.filter(
    elem => elem.contractName === 'SynthereumFinder',
  )[0].address;

  const keys = getKeysForNetwork(network, accounts);

  const admin = rolesConfig[networkId]?.admin ?? accounts[0];
  const maintainer = rolesConfig[networkId]?.maintainer ?? accounts[1];
  let roles = {
    admin,
    maintainer,
  };
  await deploy(
    web3,
    deployer,
    network,
    MoneyMarketManager,
    roles,
    synthereumFinderAddress,
    { from: keys.deployer },
  );
};
