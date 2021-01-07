const config = require('../truffle-config.js');
const rolesConfig = require('../data/roles.json');
const { getDeploymentInstance } = require('../utils/deployment.js');
var SynthereumDeployer = artifacts.require('SynthereumDeployer');
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
  await deploy(
    deployer,
    network,
    SynthereumDeployer,
    isDeployed
      ? synthereumFinderInstance.address
      : synthereumFinderInstance.options.address,
    roles,
    { from: keys.deployer },
  );
  const deployerInterface = await web3.utils.stringToHex('Deployer');
  const synthereumDeployerInstance = await SynthereumDeployer.deployed();
  isDeployed
    ? await synthereumFinderInstance.changeImplementationAddress(
        deployerInterface,
        synthereumDeployerInstance.address,
        { from: maintainer },
      )
    : await synthereumFinderInstance.methods
        .changeImplementationAddress(
          deployerInterface,
          synthereumDeployerInstance.address,
        )
        .send({ from: maintainer });
  console.log('SynthereumDeployer added to SynthereumFinder');
};
