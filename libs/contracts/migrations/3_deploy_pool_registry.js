const config = require('../truffle-config.js');
const rolesConfig = require('../data/roles.json');
const { getDeploymentInstance } = require('../utils/deployment.js');
var SynthereumFinder = artifacts.require('SynthereumFinder');
var SynthereumPoolRegistry = artifacts.require('SynthereumPoolRegistry');
var SynthereumInterfaces = artifacts.require('SynthereumInterfaces');
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
  const maintainer = rolesConfig[networkId]?.maintainer ?? accounts[1];
  const keys = getKeysForNetwork(network, accounts);
  await deploy(
    deployer,
    network,
    SynthereumPoolRegistry,
    isDeployed
      ? synthereumFinderInstance.address
      : synthereumFinderInstance.options.address,
    {
      from: keys.deployer,
    },
  );
  const poolRegistryInterface = await web3.utils.stringToHex('PoolRegistry');
  const synthereumPoolRegistryInstance = await SynthereumPoolRegistry.deployed();
  isDeployed
    ? await synthereumFinderInstance.changeImplementationAddress(
        poolRegistryInterface,
        synthereumPoolRegistryInstance.address,
        { from: maintainer },
      )
    : await synthereumFinderInstance.methods
        .changeImplementationAddress(
          poolRegistryInterface,
          synthereumPoolRegistryInstance.address,
        )
        .send({ from: maintainer });
  console.log('SynthereumPoolRegistry added to SynthereumFinder');
};
