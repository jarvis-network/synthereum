const config = require('../truffle-config.js');
const rolesConfig = require('../data/roles.json');
var SynthereumDeployer = artifacts.require('SynthereumDeployer');
var SynthereumFinder = artifacts.require('SynthereumFinder');
const { getKeysForNetwork, deploy } = require('@jarvis-network/uma-common');

module.exports = async function (deployer, network, accounts) {
  const networkId = await web3.eth.net.getId();
  const admin = rolesConfig[networkId]?.admin ?? accounts[0];
  const maintainer = rolesConfig[networkId]?.maintainer ?? accounts[1];
  const roles = { admin: admin, maintainer: maintainer };
  const synthereumFinderInstance = await SynthereumFinder.deployed();
  const keys = getKeysForNetwork(network, accounts);
  await deploy(
    deployer,
    network,
    SynthereumDeployer,
    synthereumFinderInstance.address,
    roles,
    { from: keys.deployer },
  );
  const synthereumDeployerInstance = await SynthereumDeployer.deployed();
  await synthereumFinderInstance.changeImplementationAddress(
    await web3.utils.stringToHex('Deployer'),
    synthereumDeployerInstance.address,
    { from: maintainer },
  );
};
