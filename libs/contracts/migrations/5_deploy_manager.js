const rolesConfig = require('../data/roles.json');
const {
  getExistingInstance,
} = require('../dist/src/migration-utils/deployment');
const SynthereumManager = artifacts.require('SynthereumManager');
const SynthereumFinder = artifacts.require('SynthereumFinder');
const { getKeysForNetwork, deploy } = require('@jarvis-network/uma-common');
const { toNetworkId } = require('@jarvis-network/web3-utils/eth/networks');

module.exports = async function (deployer, network, accounts) {
  const networkId = toNetworkId(network);
  const synthereumFinder = await getExistingInstance(web3, SynthereumFinder);
  const admin = rolesConfig[networkId]?.admin ?? accounts[0];
  const maintainer = rolesConfig[networkId]?.maintainer ?? accounts[1];
  const roles = { admin: admin, maintainer: maintainer };
  const keys = getKeysForNetwork(network, accounts);
  await deploy(
    deployer,
    network,
    SynthereumManager,
    synthereumFinder.options.address,
    roles,
    { from: keys.deployer },
  );
  const deployerInterface = await web3.utils.stringToHex('Manager');
  const synthereumManager = await getExistingInstance(web3, SynthereumManager);
  await synthereumFinder.methods
    .changeImplementationAddress(
      deployerInterface,
      synthereumManager.options.address,
    )
    .send({ from: maintainer });
  console.log('SynthereumManager added to SynthereumFinder');
};
