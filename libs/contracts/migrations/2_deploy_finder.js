var tdr = require('truffle-deploy-registry');
const config = require('../truffle-config.js');
const rolesConfig = require('../data/roles.json');
var SynthereumFinder = artifacts.require('SynthereumFinder');
var SynthereumInterfaces = artifacts.require('SynthereumInterfaces');

module.exports = async function (deployer, network, accounts) {
  const networkId = config.networks[network.replace(/-fork$/, '')].network_id;
  const admin = rolesConfig[networkId].admin || accounts[0];
  const maintainer = rolesConfig[networkId].maintainer || accounts[1];
  const roles = { admin: admin, maintainer: maintainer };
  await deployer.deploy(SynthereumFinder, roles, { from: accounts[0] });
  const synthereumFinderInstance = await SynthereumFinder.deployed();
  if (!tdr.isDryRunNetworkName(network)) {
    return tdr.appendInstance(synthereumFinderInstance);
  }
};
