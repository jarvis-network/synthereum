const config = require('../truffle-config.js');
const rolesConfig = require('../data/roles.json');
var SynthereumFinder = artifacts.require('SynthereumFinder');
var SynthereumPoolRegistry = artifacts.require('SynthereumPoolRegistry');
var SynthereumInterfaces = artifacts.require('SynthereumInterfaces');
const { getKeysForNetwork, deploy } = require('@jarvis-network/uma-common');

module.exports = async function (deployer, network, accounts) {
  const networkId = await web3.eth.net.getId();
  const maintainer = rolesConfig[networkId]?.maintainer ?? accounts[1];
  const synthereumFinderInstance = await SynthereumFinder.deployed();
  const keys = getKeysForNetwork(network, accounts);
  await deploy(
    deployer,
    network,
    SynthereumPoolRegistry,
    synthereumFinderInstance.address,
    {
      from: keys.deployer,
    },
  );
  const synthereumPoolRegistryInstance = await SynthereumPoolRegistry.deployed();
  await synthereumFinderInstance.changeImplementationAddress(
    await web3.utils.stringToHex('PoolRegistry'),
    synthereumPoolRegistryInstance.address,
    { from: maintainer },
  );
};
