var tdr = require('truffle-deploy-registry');
const config = require('../truffle-config.js');
const rolesConfig = require('../data/roles.json');
var SynthereumDeployer = artifacts.require('SynthereumDeployer');
var SynthereumFinder = artifacts.require('SynthereumFinder');

module.exports = async function (deployer, network, accounts) {
  const networkId = config.networks[network.replace(/-fork$/, '')].network_id;
  const admin = rolesConfig[networkId].admin || accounts[0];
  const maintainer = rolesConfig[networkId].maintainer || accounts[1];
  const roles = { admin: admin, maintainer: maintainer };
  const synthereumFinderInstance = await SynthereumFinder.deployed();
  await deployer.deploy(
    SynthereumDeployer,
    synthereumFinderInstance.address,
    roles,
    { from: accounts[0] },
  );
  const synthereumDeployerInstance = await SynthereumDeployer.deployed();
  await synthereumFinderInstance.changeImplementationAddress(
    await web3.utils.stringToHex('Deployer'),
    synthereumDeployerInstance.address,
    { from: maintainer },
  );
  if (!tdr.isDryRunNetworkName(network)) {
    return tdr.appendInstance(synthereumDeployerInstance);
  }
};
