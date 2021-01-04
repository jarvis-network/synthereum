const config = require('../truffle-config.js');
const rolesConfig = require('../data/roles.json');
var SynthereumFactoryVersioning = artifacts.require(
  'SynthereumFactoryVersioning',
);
var SynthereumFinder = artifacts.require('SynthereumFinder');
const { getKeysForNetwork, deploy } = require('@jarvis-network/uma-common');

module.exports = async function (deployer, network, accounts) {
  const networkId = await web3.eth.net.getId();
  const admin = rolesConfig[networkId]?.admin ?? accounts[0];
  const maintainer = rolesConfig[networkId]?.maintainer ?? accounts[1];
  const roles = { admin: admin, maintainer: maintainer };
  const keys = getKeysForNetwork(network, accounts);
  await deploy(deployer, network, SynthereumFactoryVersioning, roles, {
    from: keys.deployer,
  });
  const synthereumFactoryVersioningInstance = await SynthereumFactoryVersioning.deployed();
  const synthereumFinderInstance = await SynthereumFinder.deployed();
  await synthereumFinderInstance.changeImplementationAddress(
    await web3.utils.stringToHex('FactoryVersioning'),
    synthereumFactoryVersioningInstance.address,
    { from: maintainer },
  );
};
