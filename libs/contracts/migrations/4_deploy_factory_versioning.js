const config = require('../truffle-config.js');
const rolesConfig = require('../data/roles.json');
const { getDeploymentInstance } = require('../utils/deployment.js');
var SynthereumFactoryVersioning = artifacts.require(
  'SynthereumFactoryVersioning',
);
var SynthereumFinder = artifacts.require('SynthereumFinder');
const { getKeysForNetwork, deploy } = require('@jarvis-network/uma-common');

module.exports = async function (deployer, network, accounts) {
  const networkId = await web3.eth.net.getId();
  const {
    contractInstance: synthereumFinderInstance,
    isDeployed,
  } = await getDeploymentInstance(
    SynthereumFinder,
    'SynthereumFinder',
    networkId,
  );
  const admin = rolesConfig[networkId]?.admin ?? accounts[0];
  const maintainer = rolesConfig[networkId]?.maintainer ?? accounts[1];
  const roles = { admin: admin, maintainer: maintainer };
  const keys = getKeysForNetwork(network, accounts);
  await deploy(deployer, network, SynthereumFactoryVersioning, roles, {
    from: keys.deployer,
  });

  const factoryVersioningInterface = await web3.utils.stringToHex(
    'FactoryVersioning',
  );
  const synthereumFactoryVersioningInstance = await SynthereumFactoryVersioning.deployed();
  isDeployed
    ? await synthereumFinderInstance.changeImplementationAddress(
        factoryVersioningInterface,
        synthereumFactoryVersioningInstance.address,
        { from: maintainer },
      )
    : await synthereumFinderInstance.methods
        .changeImplementationAddress(
          factoryVersioningInterface,
          synthereumFactoryVersioningInstance.address,
        )
        .send({ from: maintainer });
  console.log('SynthereumFactoryVersioning added to SynthereumFinder');
};
