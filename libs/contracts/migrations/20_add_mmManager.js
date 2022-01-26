const web3Utils = require('web3-utils');
const { artifacts } = require('hardhat');
const MoneyMarketManager = artifacts.require('MoneyMarketManager');
const SynthereumFinder = artifacts.require('SynthereumFinder');
const { toNetworkId } = require('@jarvis-network/core-utils/dist/eth/networks');
const {
  getKeysForNetwork,
  deploy,
} = require('@jarvis-network/hardhat-utils/dist/deployment/migrationUtils');
const deployment = require('../data/deployment/mmManager.json');
const rolesConfig = require('../data/roles.json');

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

  if (deployment[networkId]?.moneyMarketManager != '') {
    // set MoneyMarketManager address in finder
    let finder = await SynthereumFinder.at(synthereumFinderAddress);
    await finder.changeImplementationAddress(
      web3Utils.toHex('MoneyMarketManager'),
      deployment[networkId].moneyMarketManager,
      { from: roles.maintainer },
    );
  }
};
