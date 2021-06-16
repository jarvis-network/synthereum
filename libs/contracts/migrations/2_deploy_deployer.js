const rolesConfig = require('../data/roles.json');
const { getExistingInstance } = require('../dist/migration-utils/deployment');
const SynthereumDeployer = artifacts.require('SynthereumDeployer');
const SynthereumFinder = artifacts.require('SynthereumFinder');
const { getKeysForNetwork, deploy } = require('@jarvis-network/uma-common');
const { toNetworkId } = require('@jarvis-network/core-utils/dist/eth/networks');

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
    SynthereumDeployer,
    synthereumFinder.options.address,
    roles,
    { from: keys.deployer },
  );
  const deployerInterface = await web3.utils.stringToHex('Deployer');
  const synthereumDeployer = await getExistingInstance(
    web3,
    SynthereumDeployer,
  );
  await synthereumFinder.methods
    .changeImplementationAddress(
      deployerInterface,
      synthereumDeployer.options.address,
    )
    .send({ from: maintainer });
  console.log('SynthereumDeployer added to SynthereumFinder');
};
