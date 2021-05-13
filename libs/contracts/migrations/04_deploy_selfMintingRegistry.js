module.exports = require('../utils/getContractsFactory')(migrate, [
  'SynthereumFinder',
  'SelfMintingRegistry',
]);

async function migrate(deployer, network, accounts) {
  const rolesConfig = require('../data/roles.json');
  const {
    getExistingInstance,
  } = require('../dist/migration-utils/deployment');
  const { SynthereumFinder, SelfMintingRegistry } = migrate.getContracts(
    artifacts,
  );
  const { getKeysForNetwork, deploy } = require('@jarvis-network/uma-common');
  const {
    toNetworkId,
  } = require('@jarvis-network/core-utils/dist/eth/networks');

  const networkId = toNetworkId(network);
  const synthereumFinder = await getExistingInstance(web3, SynthereumFinder);
  const maintainer = rolesConfig[networkId]?.maintainer ?? accounts[1];
  const keys = getKeysForNetwork(network, accounts);
  await deploy(
    deployer,
    network,
    SelfMintingRegistry,
    synthereumFinder.options.address,
    {
      from: keys.deployer,
    },
  );
  const selfMintingRegistryInterface = await web3.utils.stringToHex(
    'SelfMintingRegistry',
  );
  const selfMintingRegistry = await getExistingInstance(
    web3,
    SelfMintingRegistry,
  );
  await synthereumFinder.methods
    .changeImplementationAddress(
      selfMintingRegistryInterface,
      selfMintingRegistry.options.address,
    )
    .send({ from: maintainer });
  console.log('SelfMintingRegistry added to SynthereumFinder');
}
