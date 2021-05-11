const rolesConfig = require('../data/roles.json');
const { getExistingInstance } = require('../dist/migration-utils/deployment');
const SynthereumFinder = artifacts.require('SynthereumFinder');
const SynthereumSyntheticTokenFactory = artifacts.require(
  'SynthereumSyntheticTokenFactory',
);
const SynthereumInterfaces = artifacts.require('SynthereumInterfaces');
const { getKeysForNetwork, deploy } = require('@jarvis-network/uma-common');
const { toNetworkId } = require('@jarvis-network/core-utils/dist/eth/networks');

module.exports = async function (deployer, network, accounts) {
  const networkId = toNetworkId(network);
  const maintainer = rolesConfig[networkId]?.maintainer ?? accounts[1];
  const synthereumFinder = await getExistingInstance(web3, SynthereumFinder);
  const keys = getKeysForNetwork(network, accounts);
  await deploy(
    deployer,
    network,
    SynthereumSyntheticTokenFactory,
    synthereumFinder.options.address,
    { from: keys.deployer },
  );
  const tokenFactoryInterface = await web3.utils.stringToHex('TokenFactory');
  const tokenFactory = await getExistingInstance(
    web3,
    SynthereumSyntheticTokenFactory,
  );
  await synthereumFinder.methods
    .changeImplementationAddress(
      tokenFactoryInterface,
      tokenFactory.options.address,
    )
    .send({ from: maintainer });
  console.log('SynthereumSyntheticTokenFactory added to SynthereumFinder');
};
