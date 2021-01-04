var tdr = require('truffle-deploy-registry');
const config = require('../truffle-config.js');
const rolesConfig = require('../data/roles.json');
var SynthereumFinder = artifacts.require('SynthereumFinder');
var SynthereumInterfaces = artifacts.require('SynthereumInterfaces');
const { getKeysForNetwork, deploy } = require('@jarvis-network/uma-common');

module.exports = async function (deployer, network, accounts) {
  const networkId = await web3.eth.net.getId();
  const admin = rolesConfig[networkId]?.admin ?? accounts[0];
  const maintainer = rolesConfig[networkId]?.maintainer ?? accounts[1];
  const roles = { admin: admin, maintainer: maintainer };
  const keys = getKeysForNetwork(network, accounts);

  await deploy(deployer, network, SynthereumFinder, roles, {
    from: keys.deployer,
  });
};
