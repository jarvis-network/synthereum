const rolesConfig = require('../data/roles.json');
const {
  getExistingInstance,
} = require('../dist/src/migration-utils/deployment');
const SynthereumFinder = artifacts.require('SynthereumFinder');
const SynthereumPoolRegistry = artifacts.require('SynthereumPoolRegistry');
const SynthereumInterfaces = artifacts.require('SynthereumInterfaces');
const { getKeysForNetwork, deploy } = require('@jarvis-network/uma-common');
const { toNetworkId } = require('@jarvis-network/core-utils/dist/eth/networks');

module.exports = async function (deployer, network, accounts) {
  const networkId = toNetworkId(network);
  const synthereumFinder = await getExistingInstance(web3, SynthereumFinder);
  const maintainer = rolesConfig[networkId]?.maintainer ?? accounts[1];
  const keys = getKeysForNetwork(network, accounts);
  await deploy(
    deployer,
    network,
    SynthereumPoolRegistry,
    synthereumFinder.options.address,
    {
      from: keys.deployer,
    },
  );
  const poolRegistryInterface = await web3.utils.stringToHex('PoolRegistry');
  const synthereumPoolRegistry = await getExistingInstance(
    web3,
    SynthereumPoolRegistry,
  );
  await synthereumFinder.methods
    .changeImplementationAddress(
      poolRegistryInterface,
      synthereumPoolRegistry.options.address,
    )
    .send({ from: maintainer });
  console.log('SynthereumPoolRegistry added to SynthereumFinder');
};
